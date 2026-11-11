CREATE TABLE bootstrap_state (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0)
);

INSERT INTO bootstrap_state (id, schema_version) VALUES (1, 1);
