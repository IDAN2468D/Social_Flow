FROM docker.elastic.co/elasticsearch/elasticsearch:8.13.0

ENV discovery.type=single-node \
    xpack.security.enabled=false \
    xpack.ml.enabled=false \
    ES_JAVA_OPTS="-Xms512m -Xmx512m" \
    http.host=0.0.0.0 \
    http.port=9200

EXPOSE 9200
