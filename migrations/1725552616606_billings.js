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
  pgm.createTable('billings', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    account_id: {
      type: 'uuid',
      notNull: true,
      references: 'accounts',
      onDelete: 'cascade',
    },
    client_id: {
      type: 'uuid',
      notNull: true,
      references: 'clients',
      onDelete: 'cascade',
    },
    payment_method: {
      type: 'varchar(15)',
      notNull: true,
    },
    description: {
      type: 'varchar(150)',
      notNull: true,
    },
    amount: {
      type: 'decimal(6,2)',
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
    payed_at: {
      type: 'timestamptz',
      default: pgm.func('current_timestamp'),
    },
  });
  pgm.createIndex('billings', 'account_id');
  pgm.createIndex('billings', 'client_id');
  pgm.createIndex('billings', 'payed_at');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('billings');
};
