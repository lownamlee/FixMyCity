package fixmycity.case_access

import rego.v1

default allow := false

allow if {
  input.action == "case.create"
  input.subject.id != ""
}

# Resource facts are loaded by the server; clients cannot choose owner,
# jurisdiction, assignees, or evidence access in their authorization request.
allow if {
  "administrator" in input.subject.roles
  input.action in {"case.read", "case.review", "case.dispatch", "case.assign", "case.verify", "evidence.read"}
}

allow if {
  input.resource.owner == input.subject.id
  input.action in {"case.read", "case.comment", "case.write", "case.submit", "case.confirm_repair", "evidence.read_own"}
}

allow if {
  "officer" in input.subject.roles
  input.resource.jurisdiction in input.subject.jurisdictions
  input.action in {"case.read", "case.comment", "case.review", "case.dispatch", "case.assign", "case.verify", "evidence.read"}
}

allow if {
  "dispatcher" in input.subject.roles
  input.resource.jurisdiction in input.subject.jurisdictions
  input.action in {"case.read", "case.dispatch", "case.assign"}
}

allow if {
  "contractor" in input.subject.roles
  input.subject.id in input.resource.assignees
  input.action in {"case.read", "case.comment", "case.repair_update"}
}
