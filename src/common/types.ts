import * as stream from "stream";
import tus from "tus-js-client";

namespace ts {
    export type AmqpConfig = {
        connection: AmqpConnection;
        messaging: AmqpMessaging;
    }

    export type AmqpConnection = {
        scheme: string;
        host: string;
        port: string;
    }

    export type AmqpMessaging = {
        exchange: string;
        exchangeType: string;
        queueName: string;
        routingKey: string;
    }

    export type ConvertFilesJob = {
        reads: ConvertFile[],
        outputName: string,
        outputDir: string;
    }

    export type DownloadS3FilesJob = {
        basePath: string,
        container: string,
        files: DownloadFile[]
    }

    export type DownloadBundleFilesJob = {
        basePath: string,
        container: string,
        bundleUuid: string,
        files: FileName[]
    }

    export type UploadFilesJob = {
        files: FileName[],
        manifestId: string,
        submissionUrl: string,
        dspUrl: string
    }

    export type FileName = {
        fileName: string,
    }

    export type ConvertFile = {
        readIndex: string,
        fileName: string
    }

    export type DownloadFile = {
        fileName: string,
        source: string
    }

    export type ConnectionProperties = {
        scheme: string,
        host: string,
        port: string
    }

    export type S3Location = {
        s3Bucket: string,
        s3Key: string,
        s3Url?: URL
    }

    export type S3Auth = {
        accessKeyId: string,
        secret?: string,
        sessionToken?: string
    }

    export type S3Info = {
        s3Location: S3Location,
        s3AuthInfo?: S3Auth
    }

    export type TusMetadata = {
        key: string,
        value: string | number | boolean
    }

    export type FileInfo = {
        fileName: string,
        filePath: string,
        fileSize?: number,
        fileStream?: stream.Readable
    }

    export type AAPCredentials = {
        username: string,
        password: string
    }

    export type TokenCache = {
        token?: string,
        tokenDurationMs: number,
        cachedTimeMs?: number,
        refreshPeriodMs: number
    }

    export type Fastq2BamParams = {
        schema: string,
        outputBamFilename: string,
        inputFastqs: string[]
    }

    export type File = {
        name: string,
        read_index: string,
        cloud_url?: string
    }

    export type Job = {
        dsp_api_url: string,
        ingest_api_url: string,
        submission_url: string,
        files: File[],
        manifest_id: string,
        dcp_bundle_uuid?: string
        conversion?: Conversion
    }

    export type Conversion = {
        output_name: string,
        inputs: File[]
    }

    export type Plan = {
        jobs: Job[]
    }

    export type AlreadyUploaded = "ALREADY_UPLOADED";

    export type UploadAssertion = tus.Upload | AlreadyUploaded;
}

export = ts;
