FROM provectuslabs/kafka-ui:latest

ENV SERVER_PORT=8080 \
    DYNAMIC_CONFIG_ENABLED=true

EXPOSE 8080

CMD ["sh", "-c", "export SERVER_PORT=${PORT:-8080} && exec java -XX:+UseSerialGC -Xmx256m -Xms64m -jar /api.jar"]
