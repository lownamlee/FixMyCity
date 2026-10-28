CREATE SEQUENCE IF NOT EXISTS fmc_report_number START WITH 43;
CREATE TABLE IF NOT EXISTS fmc_reports (
 id text PRIMARY KEY DEFAULT ('FMC-' || lpad(nextval('fmc_report_number')::text,3,'0')),
 draft_key uuid UNIQUE NOT NULL,
 resident text NOT NULL DEFAULT 'Aina Rahman',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted')),
 assessment jsonb NOT NULL,
 photos jsonb NOT NULL DEFAULT '[]',
 protected_photos jsonb NOT NULL DEFAULT '[]',
 privacy_reviewed boolean NOT NULL DEFAULT false,
 linked_hazard text REFERENCES fmc_reports(id),
 link_kind text,
 proposal jsonb NOT NULL DEFAULT '{}',
 proposal_version integer NOT NULL DEFAULT 1,
 approved_version integer,
 response_state text NOT NULL DEFAULT 'proposed',
 dispatch_receipt text,
 tracking_mode text NOT NULL DEFAULT 'none',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 fixture boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS fmc_report_events (
 id bigserial PRIMARY KEY, report_id text NOT NULL REFERENCES fmc_reports(id),
 event text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fmc_report_events_report ON fmc_report_events(report_id,id);
CREATE TABLE IF NOT EXISTS fmc_telemetry (
 report_id text NOT NULL REFERENCES fmc_reports(id), sequence integer NOT NULL,
 lat double precision NOT NULL, lng double precision NOT NULL,
 sampled_at timestamptz NOT NULL, mode text NOT NULL CHECK(mode='replay'),
 PRIMARY KEY(report_id,sequence)
);
CREATE TABLE IF NOT EXISTS fmc_repairs (
 report_id text PRIMARY KEY REFERENCES fmc_reports(id),
 state text NOT NULL DEFAULT 'open', before_photo text, after_photo text,
 comparison jsonb, authority_note text, completed_at timestamptz, reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS fmc_contributions (
 id bigserial PRIMARY KEY, report_id text NOT NULL REFERENCES fmc_reports(id),
 resident text NOT NULL, kind text NOT NULL, points integer NOT NULL CHECK(points=15),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(report_id,resident,kind)
);
ALTER TABLE fmc_reports ADD COLUMN IF NOT EXISTS photo_diagnostics jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS fmc_case_links (
 id bigserial PRIMARY KEY, source_id text NOT NULL REFERENCES fmc_reports(id), target_id text NOT NULL REFERENCES fmc_reports(id),
 kind text NOT NULL CHECK(kind IN ('duplicate','related_hazard','recurrence')), reason text NOT NULL,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), reversed_at timestamptz,
 CHECK(source_id<>target_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS fmc_active_link ON fmc_case_links(source_id,target_id,kind) WHERE active;
CREATE TABLE IF NOT EXISTS fmc_agent_config (
 id text PRIMARY KEY, version integer NOT NULL DEFAULT 1, settings jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fmc_reviewed_knowledge (
 id bigserial PRIMARY KEY, report_id text REFERENCES fmc_reports(id), question text NOT NULL, answer text NOT NULL,
 scope text NOT NULL, approved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fmc_one_duplicate_group ON fmc_case_links(source_id) WHERE active AND kind='duplicate';
CREATE INDEX IF NOT EXISTS fmc_case_link_targets ON fmc_case_links(target_id);
CREATE INDEX IF NOT EXISTS fmc_submitted_reports ON fmc_reports(created_at DESC) WHERE status='submitted';

ALTER TABLE public.fmc_reports ADD COLUMN IF NOT EXISTS owner_key text;
CREATE INDEX IF NOT EXISTS fmc_reports_owner ON public.fmc_reports(owner_key);
CREATE INDEX IF NOT EXISTS fmc_reports_linked_hazard ON public.fmc_reports(linked_hazard);
CREATE INDEX IF NOT EXISTS fmc_knowledge_report ON public.fmc_reviewed_knowledge(report_id);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fmc_backend') THEN CREATE ROLE fmc_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='fmc_admin') THEN CREATE ROLE fmc_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $$;
GRANT CONNECT ON DATABASE postgres TO fmc_backend,fmc_admin;
GRANT USAGE ON SCHEMA public TO fmc_backend,fmc_admin;
ALTER TABLE public.fmc_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_reports FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_reports TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_reports TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_reports TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_reports TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_report_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_report_events FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_report_events TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_report_events TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_report_events TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_report_events TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_telemetry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_telemetry FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_telemetry TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_telemetry TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_telemetry TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_telemetry TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_repairs FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_repairs TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_repairs TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_repairs TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_repairs TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_contributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_contributions FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_contributions TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_contributions TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_contributions TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_contributions TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_case_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_case_links FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_case_links TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_case_links TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON public.fmc_case_links TO fmc_backend;
CREATE POLICY backend_access ON public.fmc_case_links TO fmc_backend USING(true) WITH CHECK(true);
ALTER TABLE public.fmc_agent_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_agent_config FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_agent_config TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_agent_config TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT ON public.fmc_agent_config TO fmc_backend;
CREATE POLICY backend_read ON public.fmc_agent_config FOR SELECT TO fmc_backend USING(true);
ALTER TABLE public.fmc_reviewed_knowledge ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fmc_reviewed_knowledge FROM anon,authenticated,PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fmc_reviewed_knowledge TO fmc_admin;
CREATE POLICY admin_access ON public.fmc_reviewed_knowledge TO fmc_admin USING(true) WITH CHECK(true);
GRANT SELECT ON public.fmc_reviewed_knowledge TO fmc_backend;
CREATE POLICY backend_read ON public.fmc_reviewed_knowledge FOR SELECT TO fmc_backend USING(approved);
REVOKE ALL ON SEQUENCE public.fmc_report_number FROM anon,authenticated,PUBLIC;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.fmc_report_number TO fmc_admin;
GRANT USAGE,SELECT ON SEQUENCE public.fmc_report_number TO fmc_backend;
REVOKE ALL ON SEQUENCE public.fmc_report_events_id_seq FROM anon,authenticated,PUBLIC;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.fmc_report_events_id_seq TO fmc_admin;
GRANT USAGE,SELECT ON SEQUENCE public.fmc_report_events_id_seq TO fmc_backend;
REVOKE ALL ON SEQUENCE public.fmc_contributions_id_seq FROM anon,authenticated,PUBLIC;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.fmc_contributions_id_seq TO fmc_admin;
GRANT USAGE,SELECT ON SEQUENCE public.fmc_contributions_id_seq TO fmc_backend;
REVOKE ALL ON SEQUENCE public.fmc_case_links_id_seq FROM anon,authenticated,PUBLIC;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.fmc_case_links_id_seq TO fmc_admin;
GRANT USAGE,SELECT ON SEQUENCE public.fmc_case_links_id_seq TO fmc_backend;
REVOKE ALL ON SEQUENCE public.fmc_reviewed_knowledge_id_seq FROM anon,authenticated,PUBLIC;
GRANT USAGE,SELECT,UPDATE ON SEQUENCE public.fmc_reviewed_knowledge_id_seq TO fmc_admin;
GRANT USAGE,SELECT ON SEQUENCE public.fmc_reviewed_knowledge_id_seq TO fmc_backend;
