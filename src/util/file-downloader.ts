import Promise from "bluebird";

export interface IFileDownloader {
    assertFile(file: string, baseDir: string): Promise<void>;
}

export default IFileDownloader
