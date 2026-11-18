--
-- PostgreSQL database dump
--

\restrict ydHd1yfXRKM8a7XHfDFFxzvnHGTOk7F3XpuMgWRkUzb9Diyp4cxq6BGMAUYz3rR

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    type integer,
    payload jsonb
);


--
-- Name: analyzes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analyzes (
    id text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    ip text,
    ua jsonb,
    country text,
    path text,
    referer text
);


--
-- Name: search_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.search_documents (
    id text NOT NULL,
    ref_type text NOT NULL,
    ref_id text NOT NULL,
    title text NOT NULL,
    search_text text NOT NULL,
    terms text[] DEFAULT '{}'::text[] NOT NULL,
    title_term_freq jsonb DEFAULT '{}'::jsonb NOT NULL,
    body_term_freq jsonb DEFAULT '{}'::jsonb NOT NULL,
    title_length integer DEFAULT 0 NOT NULL,
    body_length integer DEFAULT 0 NOT NULL,
    slug text,
    nid integer,
    is_published boolean DEFAULT true NOT NULL,
    public_at timestamp with time zone,
    has_password boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    modified_at timestamp with time zone,
    lang text NOT NULL,
    source_hash text DEFAULT ''::text NOT NULL
);


--
-- Name: serverless_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serverless_logs (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    function_id text,
    reference text NOT NULL,
    name text NOT NULL,
    method text,
    ip text,
    status text NOT NULL,
    execution_time integer NOT NULL,
    logs jsonb,
    error jsonb
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    user_id text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone,
    ip_address text,
    user_agent text,
    provider text
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    identifier text NOT NULL,
    value text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id text NOT NULL,
    "timestamp" timestamp with time zone,
    headers jsonb,
    payload jsonb,
    event text,
    response jsonb,
    success boolean,
    hook_id text NOT NULL,
    status integer DEFAULT 0 NOT NULL
);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: analyzes analyzes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analyzes
    ADD CONSTRAINT analyzes_pkey PRIMARY KEY (id);


--
-- Name: search_documents search_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.search_documents
    ADD CONSTRAINT search_documents_pkey PRIMARY KEY (id);


--
-- Name: serverless_logs serverless_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serverless_logs
    ADD CONSTRAINT serverless_logs_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: activities_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_created_at_idx ON public.activities USING btree (created_at);


--
-- Name: analyzes_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyzes_timestamp_idx ON public.analyzes USING btree ("timestamp");


--
-- Name: analyzes_timestamp_ip_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyzes_timestamp_ip_idx ON public.analyzes USING btree ("timestamp", ip);


--
-- Name: analyzes_timestamp_path_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyzes_timestamp_path_idx ON public.analyzes USING btree ("timestamp", path);


--
-- Name: analyzes_timestamp_referer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX analyzes_timestamp_referer_idx ON public.analyzes USING btree ("timestamp", referer);


--
-- Name: search_documents_lang_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_documents_lang_idx ON public.search_documents USING btree (lang);


--
-- Name: search_documents_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX search_documents_published_idx ON public.search_documents USING btree (is_published, public_at);


--
-- Name: search_documents_ref_lang_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX search_documents_ref_lang_uniq ON public.search_documents USING btree (ref_type, ref_id, lang);


--
-- Name: serverless_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serverless_logs_created_at_idx ON public.serverless_logs USING btree (created_at);


--
-- Name: serverless_logs_function_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serverless_logs_function_idx ON public.serverless_logs USING btree (function_id, created_at);


--
-- Name: serverless_logs_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serverless_logs_reference_idx ON public.serverless_logs USING btree (reference, name, created_at);


--
-- Name: sessions_token_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sessions_token_uniq ON public.sessions USING btree (token);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: verifications_identifier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_identifier_idx ON public.verifications USING btree (identifier);


--
-- Name: webhook_events_hook_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_events_hook_id_idx ON public.webhook_events USING btree (hook_id);


--
-- Name: webhook_events_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_events_timestamp_idx ON public.webhook_events USING btree ("timestamp");


--
-- Name: sessions sessions_user_id_readers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_readers_id_fk FOREIGN KEY (user_id) REFERENCES public.readers(id) ON DELETE CASCADE;


--
-- Name: webhook_events webhook_events_hook_id_webhooks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_hook_id_webhooks_id_fk FOREIGN KEY (hook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ydHd1yfXRKM8a7XHfDFFxzvnHGTOk7F3XpuMgWRkUzb9Diyp4cxq6BGMAUYz3rR
