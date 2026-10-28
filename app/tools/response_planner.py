"""Prepare a human-reviewed response proposal using OSRM and OR-Tools.

Reads one JSON request from standard input and returns one JSON response. This
process never dispatches vehicles or persists assignments. Coordinates are sent
only to the explicitly configured routing service.
"""
import json
import math
import os
import sys
from urllib.parse import urlsplit

import requests
from ortools.constraint_solver import pywrapcp, routing_enums_pb2

MAX_INCIDENTS = 40
MAX_VEHICLES = 20
UNREACHABLE = 10**8


def point(value):
    if not isinstance(value, dict):
        raise ValueError("A coordinate must contain lat and lng.")
    lat, lng = value.get("lat"), value.get("lng")
    if isinstance(lat, bool) or isinstance(lng, bool) or not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        raise ValueError("Coordinates must be numeric.")
    if not math.isfinite(lat) or not math.isfinite(lng) or not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise ValueError("Coordinates are outside the valid range.")
    return lat, lng


def identifier(value):
    if not isinstance(value, str) or not value.strip() or len(value) > 120:
        raise ValueError("Every incident and vehicle requires an identifier.")
    return value.strip()


def integer(value, minimum, maximum, field):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"Invalid {field}.")
    return value


def capabilities(value):
    if not isinstance(value, list) or len(value) > 40 or any(not isinstance(v, str) or not v.strip() or len(v) > 80 for v in value):
        raise ValueError("Capabilities must be a list of short strings.")
    return {v.strip().casefold() for v in value}


def route_service():
    base = os.environ.get("FMC_OSRM_URL", "").rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError("Configure FMC_OSRM_URL for an approved OSRM server.")
    return base


def coordinates(points):
    return ";".join(f"{lng:.7f},{lat:.7f}" for lat, lng in points)


def osrm(base, endpoint, points, params):
    response = requests.get(f"{base}/{endpoint}/v1/driving/{coordinates(points)}", params=params, timeout=(3, 15), allow_redirects=False)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok":
        raise ValueError("The routing service could not find a route.")
    return data


def plan(payload):
    incidents = payload.get("incidents")
    vehicles = payload.get("vehicles")
    if not isinstance(incidents, list) or not 1 <= len(incidents) <= MAX_INCIDENTS:
        raise ValueError("Provide between 1 and 40 incidents.")
    if not isinstance(vehicles, list) or not 1 <= len(vehicles) <= MAX_VEHICLES:
        raise ValueError("Provide between 1 and 20 available vehicles.")
    ids = [identifier(item.get("id")) for item in incidents]
    vehicle_ids = [identifier(item.get("id")) for item in vehicles]
    if len(set(ids)) != len(ids) or len(set(vehicle_ids)) != len(vehicle_ids):
        raise ValueError("Incident and vehicle identifiers must be unique.")
    starts = [point(v.get("location")) for v in vehicles]
    destinations = [point(i.get("location")) for i in incidents]
    available = [capabilities(v.get("capabilities", [])) for v in vehicles]
    required = [capabilities(i.get("requiredCapabilities", [])) for i in incidents]
    service = [integer(i.get("serviceSeconds", 0), 0, 86400, "service time") for i in incidents]
    shifts = [integer(v.get("maxDurationSeconds", 28800), 60, 172800, "vehicle shift") for v in vehicles]
    penalties = [integer(i.get("unassignedPenalty", 1000000), 1, 100000000, "unassigned penalty") for i in incidents]
    points = starts + destinations
    base = route_service()
    matrix = osrm(base, "table", points, {"annotations": "duration,distance"})
    durations, distances = matrix["durations"], matrix["distances"]
    if len(durations) != len(points) or any(len(row) != len(points) for row in durations):
        raise ValueError("The routing service returned an invalid matrix.")
    manager = pywrapcp.RoutingIndexManager(len(points), len(vehicles), list(range(len(vehicles))), list(range(len(vehicles))))
    routing = pywrapcp.RoutingModel(manager)

    def transit(source, target):
        a, b = manager.IndexToNode(source), manager.IndexToNode(target)
        seconds = durations[a][b]
        return (UNREACHABLE if seconds is None else int(math.ceil(seconds))) + (service[a-len(vehicles)] if a >= len(vehicles) else 0)

    callback = routing.RegisterTransitCallback(transit)
    routing.SetArcCostEvaluatorOfAllVehicles(callback)
    routing.AddDimensionWithVehicleCapacity(callback, 0, shifts, True, "Time")
    for index, needs in enumerate(required):
        node = manager.NodeToIndex(len(vehicles) + index)
        eligible = [v for v, skills in enumerate(available) if needs <= skills]
        if eligible:
            routing.SetAllowedVehiclesForIndex(eligible, node)
        else:
            routing.ActiveVar(node).SetValue(0)
        routing.AddDisjunction([node], penalties[index])
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds = 3
    solution = routing.SolveWithParameters(params)
    if solution is None:
        raise ValueError("No feasible response plan was found.")
    proposals, assigned = [], set()
    for vehicle_index, vehicle_id in enumerate(vehicle_ids):
        current = routing.Start(vehicle_index)
        sequence = []
        while not routing.IsEnd(current):
            node = manager.IndexToNode(current)
            if node >= len(vehicles):
                sequence.append(node - len(vehicles))
            current = solution.Value(routing.NextVar(current))
        previous = vehicle_index
        for order, incident_index in enumerate(sequence, 1):
            node = len(vehicles) + incident_index
            route = osrm(base, "route", [points[previous], points[node]], {"overview": "full", "geometries": "geojson", "steps": "false"})["routes"][0]
            proposals.append({"incidentId": ids[incident_index], "vehicleId": vehicle_id, "order": order,
                              "durationSeconds": round(route["duration"]), "distanceMetres": round(route["distance"]),
                              "geometry": route["geometry"]})
            assigned.add(incident_index)
            previous = node
    return {"proposals": proposals, "unassigned": [ids[i] for i in range(len(ids)) if i not in assigned],
            "requiresAuthorityApproval": True}


def main():
    try:
        raw = sys.stdin.buffer.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("Planning request is too large.")
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise ValueError("Planning request must be an object.")
        result = plan(payload)
        print(json.dumps(result, separators=(",", ":")))
    except (ValueError, KeyError, TypeError, requests.RequestException) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
