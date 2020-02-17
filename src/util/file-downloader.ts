import Promise from "bluebird";
import {DownloadFilesJob} from "../common/types";

export interface IFileDownloader {
    assertFiles(downloadJob: DownloadFilesJob): Promise<void>;
}

export default IFileDownloader
