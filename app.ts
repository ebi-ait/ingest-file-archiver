import * as fs from "fs";
import config from "config";

import LocalFileUploadHandler from "./src/listeners/handlers/local-file-upload-handler";
import FileUploader from "./src/util/file-uploader";
import AapTokenClient from "./src/util/aap-token-client";
import {AAPCredentials, AmqpConfig} from "./src/common/types";
import Fastq2BamConverter from "./src/util/fastq-2-bam-converter";
import TokenManager from "./src/util/token-manager";
import Listener from "./src/listeners/listener";
/* ----------------------------------- */

const tokenClient = (() => {
    const aapCredentials: AAPCredentials = config.get("AUTH.usi.credentials");
    const authUrl: string = config.get("AUTH.usi.authUrl");

    return new AapTokenClient(aapCredentials, authUrl);
})();

const tokenManager = (() => {
    return new TokenManager(tokenClient, 10*60*1000, 2*60*1000);
})();

const fileUploader = (() => {
    return new FileUploader(tokenManager);
})();

const fastq2BamConverter = (() => {
    return new Fastq2BamConverter("/app/fastq/bin/fastq2bam");
})();

const dirBasePath = (() => {
    let baseDir: string = config.get("FILES.baseDir") as string
    if (baseDir.length > 1 && baseDir.endsWith('/')) {
        baseDir = baseDir.substr(0, baseDir.length - 1)
    }
    return baseDir;
})();

const localFileUploadHandler = (() => {
    return new LocalFileUploadHandler(fileUploader, fastq2BamConverter, dirBasePath);
})();


/* ----------------------------------- */
const uploadFromLocalFile = () => {
    const uploadPlanFilePath: string = config.get("FILES.uploadPlanPath");
    if (! fs.existsSync(uploadPlanFilePath)) {
        console.error("Error UPLOAD_PLAN_PATH does not exist: " + uploadPlanFilePath);
        process.exit(1)
    }
    const uploadPlanFileData: Buffer = fs.readFileSync(uploadPlanFilePath);
    localFileUploadHandler.handle(uploadPlanFileData.toString())
};

const dspFileUploadListener = (() => {
    const listener = new Listener(config.get("AMQP") as AmqpConfig, );
    listener.setHandler(localFileUploadHandler);
    return listener;
})();

const start = () => {
    dspFileUploadListener.start();
};

start();
