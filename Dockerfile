FROM node:13.8.0-alpine3.10

WORKDIR /app
COPY app.ts package*.json tsconfig.json ./
ADD fastq ./fastq
ADD src ./src
ADD config ./config

COPY run.sh ./run.sh
RUN chmod +x run.sh

RUN npm install
RUN npm run build-ts

# Required for fastq2bam to find its binaries
ENV PATH="${PATH}:/app/fastq/bin"
RUN chmod +x /app/fastq/bin/fastq2bam
RUN which fastq2bam

ENTRYPOINT ["/app/run.sh"]
