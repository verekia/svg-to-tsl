docker buildx build --platform linux/arm64 --load -t verekia/svg-to-tsl .
docker save -o /tmp/svg-to-tsl.tar verekia/svg-to-tsl
scp /tmp/svg-to-tsl.tar midgar:/tmp/
ssh midgar docker load --input /tmp/svg-to-tsl.tar
ssh midgar docker compose up -d svg-to-tsl
