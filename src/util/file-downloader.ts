import Promise from "bluebird";

export abstract class FileDownloader {
    /**
     *
     * Downloads a file if it doesn't exist
     *
     * @param file
     * @param baseDir
     */
    abstract assertFile(file: string, baseDir: string): Promise<void>;

}

export default FileDownloader
