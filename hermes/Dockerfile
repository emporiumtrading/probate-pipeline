# probate-hermes: Nous Research Hermes Agent as the orchestrator of the probate pipeline (owner decision 2026-11-25).
# Official image, pinned; our boot script configures it for this repo and starts the gateway with its
# OpenAI-compatible API (the dashboard's Hermes chat talks to it). Build context: repo root.
FROM nousresearch/hermes-agent:v0.23.4

USER root
# git and python3 for the pipeline's scripts; psql to read the database.
RUN apt-get -o Acquire::Retries=3 update && \
    apt-get -o Acquire::Retries=3 install -y --no-install-recommends git python3 postgresql-client ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

COPY hermes/ /opt/probate/
RUN chmod 755 /opt/probate/boot.sh

# The image's ENTRYPOINT (s6 init + main-wrapper) runs this executable as the hermes user.
CMD ["/opt/probate/boot.sh"]
