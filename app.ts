import * as fs from "fs";
import config from "config";

import LocalFileUploadHandler from "./src/listeners/handlers/local-file-upload-handler";
import FileUploader from "./src/util/file-uploader";
import AapTokenClient from "./src/util/aap-token-client";
import {
    AAPCredentials,
    Job,
    Plan
} from "./src/common/types";
import Fastq2BamConverter from "./src/util/fastq-2-bam-converter";
import R from "ramda";
import Promise from "bluebird";
import TokenManager from "./src/util/token-manager";
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


const uploadPlanFilePath: string = config.get("FILES.uploadPlanPath");
if (! fs.existsSync(uploadPlanFilePath)) {
    console.error("Error UPLOAD_PLAN_PATH does not exist: " + uploadPlanFilePath);
    process.exit(1)
}

const uploadPlanFileData: Buffer = fs.readFileSync(uploadPlanFilePath);
const uploadPlan: Plan = JSON.parse(uploadPlanFileData.toString());

/* ----------------------------------- */

let processUploadJobsSequential: (jobs: Job[]) => Promise<void>;

processUploadJobsSequential = (jobs: Job[]) : Promise<void> => {
    if(jobs.length == 0) {
        return Promise.resolve();
    } else {
        const job: Job = R.head(jobs)!;
        return localFileUploadHandler.doLocalFileUpload(job)
            .then(() => {
                return processUploadJobsSequential(R.tail(jobs))
            })
            .catch(error => {
                console.error("An error occured: ", error);
            });
    }
};

const start = () => {
    processUploadJobsSequential(uploadPlan.jobs)
        .then(() => {
            console.log("Finished");
            process.exit(0)
        })
        .catch(error => {
            console.error("Error: " + error.toString());
            process.exit(1)
        });
};

start();
