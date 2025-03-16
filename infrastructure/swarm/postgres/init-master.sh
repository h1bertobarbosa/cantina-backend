#!/bin/bash
echo "host replication all 0.0.0.0/0 trust" >> /var/lib/postgresql/data/pg_hba.conf
echo "wal_level = replica" >> /var/lib/postgresql/data/postgresql.conf
echo "max_wal_senders = 10" >> /var/lib/postgresql/data/postgresql.conf
echo "wal_keep_size = 64" >> /var/lib/postgresql/data/postgresql.conf
