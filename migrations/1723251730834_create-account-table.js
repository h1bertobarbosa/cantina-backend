/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable('accounts', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    external_id: {
      type: 'uuid',
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(150)',
      notNull: true,
    },
    email: {
      type: 'varchar(150)',
      notNull: true,
    },
    document: {
      type: 'varchar(20)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createIndex('accounts', 'external_id', { method: 'hash' });
  pgm.createIndex('accounts', 'document', { unique: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('accounts');
};
