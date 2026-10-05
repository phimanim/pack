CREATE TABLE "vocabularies" (
	"id" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocabularies_id_kind_pk" PRIMARY KEY("id","kind")
);
