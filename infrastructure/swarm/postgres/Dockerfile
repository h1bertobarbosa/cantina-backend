FROM postgres:16
COPY init-master.sh /docker-entrypoint-initdb.d/
RUN chmod +x /docker-entrypoint-initdb.d/init-master.sh
EXPOSE 5432