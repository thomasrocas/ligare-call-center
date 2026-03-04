FROM eclipse-temurin:21-jdk
WORKDIR /app
COPY . .
RUN ./mvnw -q -DskipTests package || true
CMD ["./mvnw","spring-boot:run"]
