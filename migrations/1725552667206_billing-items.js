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
    billing_id: {
      type: 'uuid',
      notNull: true,
      references: 'billings',
      onDelete: 'cascade',
    },
    description: {
      type: 'varchar(150)',
      notNull: true,
    },
    value: {
      type: 'decimal(6,2)',
      notNull: true,
    },
    status: {
      type: 'varchar(15)',
      notNull: true,
    },
    payment_method: {
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
  pgm.createIndex('billing_items', 'status');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable('billing_items');
};
