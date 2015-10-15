/* transactions */
ALTER TABLE transactions DROP CONSTRAINT transactions_pkey;
CREATE UNIQUE INDEX ON transactions (txid);
ALTER TABLE transactions ADD COLUMN id BIGSERIAL PRIMARY KEY;

/* addresses */
CREATE TABLE addresses (
  id BIGSERIAL PRIMARY KEY,
  address BYTEA NOT NULL);
CREATE UNIQUE INDEX ON addresses (address);
INSERT INTO addresses(address) SELECT DISTINCT ON (address) address FROM history;

/* history */
ALTER TABLE history RENAME COLUMN oindex TO output_index;
ALTER TABLE history RENAME COLUMN ovalue TO output_value;
ALTER TABLE history RENAME COLUMN oscript TO output_script;
ALTER TABLE history RENAME COLUMN oheight TO output_height;
ALTER TABLE history RENAME COLUMN iheight TO input_height;
ALTER TABLE history ADD COLUMN address_id BIGINT REFERENCES addresses (id);
ALTER TABLE history ADD COLUMN output_tx_id BIGINT REFERENCES transactions (id);
ALTER TABLE history ADD COLUMN input_tx_id BIGINT REFERENCES transactions (id) ON DELETE SET NULL;

UPDATE history SET address_id = addresses.id FROM addresses WHERE history.address = addresses.address;
UPDATE history SET output_tx_id = transactions.id FROM transactions WHERE history.otxid = transactions.txid;
UPDATE history SET input_tx_id = transactions.id FROM transactions WHERE history.itxid = transactions.txid;

ALTER TABLE history DROP COLUMN address;
ALTER TABLE history DROP COLUMN otxid;
ALTER TABLE history DROP COLUMN itxid;
ALTER TABLE history ALTER COLUMN address_id SET NOT NULL;
ALTER TABLE history ALTER COLUMN output_tx_id SET NOT NULL;
ALTER TABLE history ALTER COLUMN output_index SET NOT NULL;
ALTER TABLE history ALTER COLUMN output_value SET NOT NULL;
ALTER TABLE history ALTER COLUMN output_script SET NOT NULL;

ALTER INDEX history_iheight_idx RENAME TO history_input_height_idx;
ALTER INDEX history_oheight_idx RENAME TO history_output_height_idx;
CREATE INDEX ON history (address_id);
CREATE INDEX ON history (output_tx_id);
CREATE INDEX ON history (output_tx_id, output_index);
CREATE INDEX ON history (input_tx_id);
