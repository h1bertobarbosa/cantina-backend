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
  pgm.createTable('billing_items', {
    id: {
      type: 'uuid',
      primaryKey: true,
    },
    transaction_id: {
      type: 'uuid',
      notNull: true,
      references: 'transactions',
      onDelete: 'restrict',
    },
    billing_id: {
      type: 'uuid',
      notNull: true,
      references: 'billings',
      onDelete: 'restrict',
    },
    type: {
      type: 'varchar(15)',
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
  pgm.createIndex('billing_items', 'billing_id');
  pgm.createIndex('billing_items', 'transaction_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('billing_items');
};
