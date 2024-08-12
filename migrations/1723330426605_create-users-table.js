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
  pgm.createTable('users', {
    id: {
      type: 'bigserial',
      primaryKey: true,
    },
    account_id: {
      type: 'bigint',
      notNull: true,
      references: 'accounts',
      onDelete: 'cascade',
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
    password: {
      type: 'varchar(150)',
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
  pgm.createIndex('users', ['account_id', 'external_id']);
  pgm.createIndex('users', ['account_id', 'email'], { unique: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('users');
};
