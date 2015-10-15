export default {
  create: {
    tables: [
      `CREATE TABLE info (
         key CHAR(100) PRIMARY KEY,
         value TEXT NOT NULL)`,
      `CREATE TABLE blocks (
         height INTEGER PRIMARY KEY,
         hash BYTEA NOT NULL,
         header BYTEA NOT NULL,
         txids BYTEA NOT NULL)`,
      `CREATE TABLE transactions (
         id BIGSERIAL PRIMARY KEY,
         txid BYTEA NOT NULL,
         height INTEGER,
         tx BYTEA NOT NULL)`,
      `CREATE TABLE addresses (
         id BIGSERIAL PRIMARY KEY,
         address BYTEA NOT NULL)`,
      `CREATE TABLE outputs (
         id BIGSERIAL PRIMARY KEY,
         tx_id BIGINT NOT NULL REFERENCES transactions (id),
         index INTEGER NOT NULL,
         value BIGINT NOT NULL,
         script BYTEA NOT NULL,
         height INTEGER)`,
      `CREATE TABLE outputs_addresses (
         output_id BIGINT NOT NULL REFERENCES outputs (id),
         address_id BIGINT NOT NULL REFERENCES addresses (id))`,
      `CREATE TABLE inputs (
         output_id BIGINT NOT NULL REFERENCES outputs (id),
         tx_id BIGINT NOT NULL REFERENCES transactions (id),
         index INTEGER NOT NULL,
         height INTEGER)`,
      `CREATE TABLE new_txs (
         id SERIAL PRIMARY KEY,
         tx BYTEA NOT NULL)`,
      `CREATE TABLE cc_scanned_txids (
        txid BYTEA PRIMARY KEY,
        blockhash BYTEA,
        height INTEGER)`
    ],
    indices: [
      `CREATE INDEX ON blocks (hash)`,
      `CREATE UNIQUE INDEX ON transactions (txid)`,
      `CREATE INDEX ON transactions (height)`,
      `CREATE UNIQUE INDEX ON addresses (address)`,
      `CREATE INDEX ON outputs (tx_id)`,
      `CREATE UNIQUE INDEX ON outputs (tx_id, index)`,
      `CREATE INDEX ON outputs (height)`,
      `CREATE INDEX ON outputs_addresses (output_id)`,
      `CREATE INDEX ON outputs_addresses (address_id)`,
      `CREATE UNIQUE INDEX ON outputs_addresses (output_id, address_id)`,
      `CREATE INDEX ON inputs (output_id)`,
      `CREATE INDEX ON inputs (tx_id)`,
      `CREATE UNIQUE INDEX ON inputs (tx_id, index)`,
      `CREATE INDEX ON inputs (height)`,
      `CREATE INDEX ON cc_scanned_txids (blockhash)`,
      `CREATE INDEX ON cc_scanned_txids (height)`
    ]
  },
  insert: {
    info: {
      row: `INSERT INTO info (key, value) VALUES ($1, $2)`
    },
    blocks: {
      row: `INSERT INTO blocks
              (height, hash, header, txids)
            VALUES
              ($1, $2, $3, $4)`
    },
    transactions: {
      confirmed: `INSERT INTO transactions
                    (txid, height, tx)
                  VALUES
                    ($1, $2, $3)
                  RETURNING
                    id AS id`,
      unconfirmed: `INSERT INTO transactions
                      (txid, tx)
                    VALUES
                      ($1, $2)
                    RETURNING
                      id AS id`
    },
    outputs: {
      confirmed: `INSERT INTO outputs
                    (tx_id, index, value, script, height)
                  VALUES
                    ($1, $2, $3, $4, $5)
                  RETURNING
                    id AS id`
    },
    outputs_addresses: {
      row: `WITH addresses_new AS (
              INSERT INTO addresses
                (address)
              SELECT
                $2
              WHERE
                NOT EXISTS (
                  SELECT
                    *
                  FROM
                    addresses
                  WHERE
                    address = $2
                )
              RETURNING
                id AS id
            )
            INSERT INTO outputs_addresses
              (output_id, address_id)
            VALUES
              ($1,
               (SELECT id FROM addresses_new
                UNION
                SELECT id FROM addresses WHERE address = $2))`
    },
    inputs: {
      confirmed: `INSERT INTO inputs
                    (output_id, tx_id, index, height)
                  VALUES
                    ((SELECT
                        outputs.id
                      FROM
                        outputs
                      INNER JOIN
                        transactions ON outputs.tx_id = transactions.id
                      WHERE
                        transactions.txid = $1 AND
                        outputs.index = $2),
                     $3,
                     $4,
                     $5)`
    },
    history: {
      unconfirmedOutput: `INSERT INTO history
                            (address_id, output_tx_id, output_index, output_value, output_script)
                          VALUES
                            ($1, $2, $3, $4, $5)`
    },
    newTx: {
      row: `INSERT INTO new_txs (tx) VALUES ($1) RETURNING id`
    },
    ccScannedTxIds: {
      unconfirmed: `INSERT INTO cc_scanned_txids
                      (txid)
                    VALUES
                      ($1)`,
      confirmed: `INSERT INTO cc_scanned_txids
                    (txid, blockhash, height)
                  VALUES
                    ($1, $2, $3)`
    }
  },
  select: {
    tablesCount: `SELECT
                    COUNT(*)
                  FROM
                    information_schema.tables
                  WHERE
                    table_name = ANY($1)`,
    info: {
      value: `SELECT value FROM info WHERE key = $1`
    },
    blocks: {
      latest: `SELECT
                 height AS height,
                 hash AS hash,
                 header AS header
               FROM
                 blocks
               ORDER BY
                 height DESC
               LIMIT 1`,
      byHeight: `SELECT
                   height AS height,
                   hash AS hash
                 FROM
                   blocks
                 WHERE
                   height = $1`,
      txIdsByHeight: `SELECT
                        height AS height,
                        hash AS hash,
                        header AS header,
                        txids AS txids
                      FROM
                        blocks
                      WHERE
                        height = $1`,
      txIdsByTxId: `SELECT
                      blocks.height AS height,
                      blocks.hash AS hash,
                      blocks.txids AS txids
                    FROM
                      blocks
                    RIGHT OUTER JOIN
                      transactions ON transactions.height = blocks.height
                    WHERE
                      txid = $1`,
      heightByHash: `SELECT
                       height AS height
                     FROM
                       blocks
                     WHERE
                       hash = $1`,
      heightByHeight: `SELECT
                         height AS height
                       FROM
                         blocks
                       WHERE
                         height = $1`,
      headers: `SELECT
                  header AS header
                FROM
                  blocks
                WHERE
                  height > $1 AND
                  height <= $2
                ORDER BY
                  height ASC`,
      exists: `SELECT EXISTS (
                 SELECT
                   true
                 FROM
                   blocks
                 WHERE
                   hash = $1
               )`
    },
    transactions: {
      byTxId: `SELECT
                 tx AS tx
               FROM
                 transactions
               WHERE
                 txid = $1`,
      byTxIds: `SELECT
                  tx AS tx
                FROM
                  transactions
                WHERE
                  txid = ANY($1)`,
      exists: `SELECT EXISTS (
                 SELECT
                   true
                 FROM
                   transactions
                 WHERE
                   txid = $1
               )`,
      existsMany: `SELECT
                     id AS id,
                     txid AS txid
                   FROM
                     transactions
                   WHERE
                     txid = ANY($1)`,
      unconfirmed: `SELECT
                      txid AS txid
                    FROM
                      transactions
                    WHERE
                      height IS NULL`
    },
    addresses: {
      byOutputHeight: `SELECT
                         addresses.address AS address,
                         transactions.txid AS txid
                       FROM
                         outputs
                       INNER JOIN
                         transactions ON transactions.id = outputs.tx_id
                       INNER JOIN
                         outputs_addresses ON outputs_addresses.output_id = outputs.id
                       INNER JOIN
                         addresses ON addresses.id = outputs_addresses.address_id
                       WHERE
                         outputs.height = $1`,
      byInputHeight: `SELECT
                        addresses.address AS address,
                        transactions.txid AS txid
                      FROM
                        inputs
                      INNER JOIN
                        outputs ON outputs.id = inputs.output_id
                      INNER JOIN
                        transactions ON transactions.id = outputs.tx_id
                      INNER JOIN
                        outputs_addresses ON outputs_addresses.output_id = outputs.id
                      INNER JOIN
                        addresses ON addresses.id = outputs_addresses.address_id
                      WHERE
                        inputs.height = $1`
    },
    history: {
      transactions: `SELECT
                       output_transactions.txid AS otxid,
                       history.output_height AS oheight,
                       input_transactions.txid AS itxid,
                       history.input_height AS iheight
                     FROM
                       history
                     INNER JOIN
                       addresses ON addresses.id = history.address_id
                     INNER JOIN
                       transactions AS output_transactions ON output_transactions.id = history.output_tx_id
                     LEFT OUTER JOIN
                       transactions AS input_transactions ON input_transactions.id = history.input_tx_id
                     WHERE
                       addresses.address = ANY($1) AND
                       (((history.output_height > $2 OR history.input_height > $2) AND
                         (history.output_height <= $3 OR history.input_height <= $3)) OR
                        history.output_height IS NULL OR
                        (history.input_height IS NULL AND history.input_tx_id IS NOT NULL))`,
      transactionsToLatest: `SELECT
                               output_transactions.txid AS otxid,
                               history.output_height AS oheight,
                               input_transactions.txid AS itxid,
                               history.input_height AS iheight
                             FROM
                               history
                             INNER JOIN
                               addresses ON addresses.id = history.address_id
                             INNER JOIN
                               transactions AS output_transactions ON output_transactions.id = history.output_tx_id
                             LEFT OUTER JOIN
                               transactions AS input_transactions ON input_transactions.id = history.input_tx_id
                             WHERE
                               addresses.address = ANY($1) AND
                               (history.output_height > $2 OR
                                history.input_height > $2 OR
                                history.output_height IS NULL OR
                                (history.input_height IS NULL AND history.input_tx_id IS NOT NULL))`,
      unspent: `SELECT
                  output_transactions.txid AS otxid,
                  history.output_index AS oindex,
                  history.output_value AS ovalue,
                  history.output_script AS oscript,
                  history.output_height AS oheight
                FROM
                  history
                INNER JOIN
                  addresses ON addresses.id = history.address_id
                INNER JOIN
                  transactions AS output_transactions ON output_transactions.id = history.output_tx_id
                WHERE
                  addresses.address = ANY($1) AND
                  history.input_tx_id IS NULL AND
                  (history.output_height IS NULL OR
                   (history.output_height > $2 AND history.output_height <= $3))`,
      unspentToLatest: `SELECT
                          output_transactions.txid AS otxid,
                          history.output_index AS oindex,
                          history.output_value AS ovalue,
                          history.output_script AS oscript,
                          history.output_height AS oheight
                        FROM
                          history
                        INNER JOIN
                          addresses ON addresses.id = history.address_id
                        INNER JOIN
                          transactions AS output_transactions ON output_transactions.id = history.output_tx_id
                        WHERE
                          addresses.address = ANY($1) AND
                          history.input_tx_id IS NULL AND
                          (history.output_height IS NULL OR history.output_height > $2)`,
      spent: `SELECT
                input_transactions.txid AS itxid,
                history.input_height AS iheight
              FROM
                history
              LEFT OUTER JOIN
                transactions AS input_transactions ON input_transactions.id = history.input_tx_id
              INNER JOIN
                transactions AS output_transactions ON output_transactions.id = history.output_tx_id
              WHERE
                output_transactions.txid = $1 AND
                history.output_index = $2`
    },
    newTxs: {
      all: `SELECT id FROM new_txs`
    },
    ccScannedTxIds: {
      latestBlock: `SELECT
                      blockhash AS blockhash,
                      height AS height
                    FROM
                      cc_scanned_txids
                    WHERE
                      height IS NOT NULL
                    ORDER BY
                      height DESC
                    LIMIT 1`,
      blockHash: `SELECT
                    blockhash AS blockhash,
                    height AS height
                  FROM
                    cc_scanned_txids
                  WHERE
                    height = $1
                  LIMIT 1`,
      isTxScanned: `SELECT EXISTS (
                      SELECT
                        true
                      FROM
                        cc_scanned_txids
                      WHERE
                        txid = $1
                    )`,
      unconfirmed: `SELECT
                      txid AS txid
                    FROM
                      cc_scanned_txids
                    WHERE
                      height IS NULL`
    },
    ccDefinitions: {
      colorId: `SELECT
                  id AS id
                FROM
                  cclib_definitions
                WHERE
                  cdesc ~ $1`
    },
    ccData: {
      coinsByDesc: `SELECT
                      cclib_data.txid AS txid,
                      cclib_data.oidx AS oidx,
                      cclib_data.value AS value,
                      cc_scanned_txids.height AS height
                    FROM
                      cclib_definitions
                    INNER JOIN
                      cclib_data ON cclib_definitions.id = cclib_data.color_id
                    INNER JOIN
                      cc_scanned_txids ON cc_scanned_txids.txid = decode(cclib_data.txid, 'hex')
                    WHERE
                      cclib_definitions.cdesc = $1`
    }
  },
  update: {
    transactions: {
      makeConfirmed: `UPDATE
                        transactions
                      SET
                        height = $1
                      WHERE
                        id = ANY($2)`,
      makeUnconfirmed: `UPDATE
                          transactions
                        SET
                          height = NULL
                        WHERE
                          height > $1
                        RETURNING
                          txid`
    },
    outputs: {
      makeConfirmed: `UPDATE
                        outputs
                      SET
                        height = $1
                      WHERE
                        outputs.tx_id = ANY($2)`,
    },
    inputs: {
      makeConfirmed: `UPDATE
                        inputs
                      SET
                        height = $1
                      FROM
                        outputs, transactions
                      WHERE
                        inputs.output_id = outputs.id AND
                        outputs.tx_id = transactions.id AND
                        transactions.txid = $2 AND
                        outputs.index = $3`
    },
    history: {
      addUnconfirmedInput: `UPDATE
                              history
                            SET
                              input_tx_id = $1
                            FROM
                              addresses, transactions
                            WHERE
                              history.address_id = addresses.id AND
                              history.output_tx_id = transactions.id AND
                              transactions.txid = $2 AND
                              history.output_index = $3
                            RETURNING
                              addresses.address AS address`,
      makeOutputsUnconfirmed: `UPDATE
                                 history
                               SET
                                 output_height = NULL
                               FROM
                                 addresses, transactions
                               WHERE
                                 history.address_id = addresses.id AND
                                 history.output_tx_id = transactions.id AND
                                 history.output_height > $1
                               RETURNING
                                 addresses.address AS address,
                                 transactions.txid AS txid`,
      makeInputsUnconfirmed: `UPDATE
                                history
                              SET
                                input_height = NULL
                              FROM
                                addresses, transactions
                              WHERE
                                history.address_id = addresses.id AND
                                history.input_tx_id = transactions.id AND
                                history.input_height > $1
                              RETURNING
                                addresses.address AS address,
                                transactions.txid AS txid`
    },
    ccScannedTxIds: {
      makeUnconfirmed: `UPDATE
                          cc_scanned_txids
                        SET
                          blockhash = NULL,
                          height = NULL
                        WHERE
                          height > $1`,
      makeConfirmed: `UPDATE
                        cc_scanned_txids
                      SET
                        blockhash = $2,
                        height = $3
                      WHERE
                        txid = ANY($1)`
    }
  },
  delete: {
    blocks: {
      fromHeight: `DELETE FROM
                     blocks
                   WHERE
                     height > $1
                   RETURNING
                     hash AS hash`
    },
    transactions: {
      unconfirmedByTxIds: `DELETE FROM
                             transactions
                           WHERE
                             height IS NULL AND
                             txid = ANY($1)
                           RETURNING
                             id AS id,
                             txid AS txid`
    },
    history: {
      unconfirmedByTxIds: `DELETE FROM
                             history
                           WHERE
                             history.output_tx_id = ANY($1) AND
                             history.output_height IS NULL
                           RETURNING
                             history.input_tx_id AS itxid`
    },
    newTx: {
      byId: `DELETE FROM
               new_txs
             WHERE
               id = $1
             RETURNING
               tx`
    },
    ccScannedTxIds: {
      byTxId: `DELETE FROM
                 cc_scanned_txids
               WHERE
                 txid = $1`
    }
  }
}
