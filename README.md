# ingest-file-archiver
Service for storing HCA sequencing data in the EBI archives.

## Running with Upload Plan
This default mode the file-archiver will read a .json file specifying files to be archived.

### Running Locally (in Docker)
1. Ensure you have a `FILE_UPLOAD_INFO.json` in a local path, which can be obtained from ingest-archiver.
1. `docker pull quay.io/ebi-ait/ingest-file-archiver`
1. `docker run -v <local_path>:/data -e BASE_DIR=/data -e UPLOAD_PLAN_PATH=/data/FILE_UPLOAD_INFO.json -e AAP_USERNAME=<provide> -e AAP_PASSWORD=<provide> -e AAP_URL=<provide> -e AWS_ACCESS_KEY_ID=<provide> -e AWS_SECRET_ACCESS_KEY=<provide> quay.io/ebi-ait/ingest-file-archiver`

- `-v <local_path>:/data` Mount a local path as the data directory.
- `-e ENVIRONMENT=var` Set an environment variable value, listed below.

### Running on EBI Cluster 
#### Step 1 - Copy FILE_UPLOAD_INFO.json to cluster
`FILE_UPLOAD_INFO.json` contains the instructions necessary for the file uploader to convert and upload submission data to the DSP.
You need to copy this file to HCA NFS directory accessible by the cluster. However, you also need to give it a unique name so that it doesn't clash with any existing JSON files.

1. Therefore, prepend something to the filename to make it unique. We suggest the project UUID.
1. You will copy the file using the secure copy (`scp`) command. This will need your EBI password and is equivalent to copying a file through ssh.

`scp FILE_UPLOAD_INFO.json ebi-cli.ebi.ac.uk:/nfs/production/hca/0f8f3885-526f-4f7e-908a-f6ea5abe9d13_FILE_UPLOAD_INFO.json`

#### Step 2 - Login to cluster
Login to EBI CLI to access the cluster with your EBI password:

`ssh ebi-cli.ebi.ac.uk`

#### Step 3 - Run the file uploader
Run the file uploader with the bsub command below. We will explain more about the components below.

`bsub 'singularity run -B /nfs/production/hca:/data docker://quay.io/ebi-ait/ingest-file-archiver -d=/data -f=/data/0f8f3885-526f-4f7e-908a-f6ea5abe9d13_FILE_UPLOAD_INFO.json -l=https://explore.api.aai.ebi.ac.uk/auth -u=<ebi-aap-user> -p=<ebi-aap-password>'`

* `bsub` - the command for submitting a job to the cluster
* `singularity` - the cluster runs jobs using Singularity containers.
* `B /nfs/production/hca:/data` - this binds the `/nfs/production/hca` directory to `/data` inside the container.
* `docker://quay.io/ebi-ait/ingest-file-archiver` - Singularity can run Docker images directly. This is the image for the file uploader.
* `-d=/data` - workspace used to store downloaded files, metadata and conversions.
* `-f=/data/0f8f3885-526f-4f7e-908a-f6ea5abe9d13_FILE_UPLOAD_INFO.json` - the location of the `FILE_UPLOAD_INFO.json` you copied in a previous step.
* `-l=https://explore.api.aai.ebi.ac.uk/auth` - The AAP API url, same as the AAP_API_URL environmental variable. As above, this will need to be `-l=https://api.aai.ebi.ac.uk/auth` instead if you are submitting to production DSP.
* `-u=<ebi-aap-user>` - The DSP user to use. Usually `hca-ingest`.
* `-p=<ebi-aap-password>` - Test or production AAP password as used previously

On submitting you will see a response along the lines

`Job <894044> is submitted to default queue <research-rh7>.`

This shows that the job has been submitted to the cluster. To see the status of the job run

`bjobs -W`

The job should be reported as running but may also be pending if the cluster is busy.

If you want to see the job's current stdout/stderr then run the [bpeek command](https://www.ibm.com/support/knowledgecenter/en/SSETD4_9.1.3/lsf_command_ref/bpeek.1.html)

`bpeek <job-id>`

Once the job is running processing may take a long time, many days in the case where a dataset has many data file conversions to perform. It will continue running after you logout and on completion or failure will e-mail you with the results. Wait until you receive this e-mail before proceeding with the next step.

Here are some further useful links about using the cluster and associated commands.

* https://sysinf.ebi.ac.uk/doku.php?id=ebi_cluster_good_computing_guide
* https://sysinf.ebi.ac.uk/doku.php?id=introducing_singularity

#### Step 4 - Check the cluster job results e-mail
The e-mail you receive will have a title similar to `Job %JOB-ID%: <singularity run> in cluster <EBI> Done`

This will contain a whole load of detail about the job run.
If you see any `WARNING` or `ERROR` messages please re-run the singularity command from the previous step (it will retry the failed steps) and tell ingest development.

 
### Upload Plan File
The ingest-archiver outputs a spec matching the required .json when attempting to archive the metadata for a HCA submission.

```metadata json
{
    "jobs": [
        "dsp_api_url": string,
        "submission_url": string,
        "files": [{
            "name": string,
            "read_index": string
            "cloud_url": string
        }],
        "manifest_id": string,
        "conversion": {
            "output_name": string,
            "inputs": [{
                "name": string,
                "read_index": string
                "cloud_url": string
            }]
        }
    ]
}
```

### Environment Variables
All environment variables must be set when running in Upload Plan mode:

- `BASE_DIR`: Full path of the base working directory space for downloading and bam-converting bundle data
  - Usually: `/data`
- `UPLOAD_PLAN_PATH`:	Full path of the bundle specification .json within the docker container.
  - Usually: `/data/FILE_UPLOAD_INFO.json`
- `AAP_URL`: URL of the AAP authn endpoint
- `AAP_USERNAME`: username of HCA AAP user account
- `AAP_PASSWORD`: password for the HCA AAP user account
- `AWS_ACCESS_KEY_ID`: AWS Access Key (with access to Ingest Upload Location)
- `AWS_SECRET_ACCESS_KEY`: AWS Secret Access Key (with access to Ingest Upload Location)

### Batch File Archiver
To speed up the upload by running uploading of sequencing runs in parallel, you could use the script here:
https://github.com/ebi-ait/hca-ebi-dev-team/tree/master/scripts/batch_file_archiver
