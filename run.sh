#!/usr/bin/env bash

for param in "$@"
do
    case $param in
	-d=*|--base-dir=*)
	    export BASE_DIR=${param#*=}
	    shift
	    ;;
	-f=*|--upload-plan=*)
	    export UPLOAD_PLAN_PATH=${param#*=}
	    shift
	    ;;
	-l=*|--aap-url=*)
	    export AAP_URL=${param#*=}
	    shift
	    ;;
	-p=*|--aap-password=*)
	    export AAP_PASSWORD=${param#*=}
	    shift
	    ;;
	-u=*|--aap-username=*)
	    export AAP_USERNAME=${param#*=}
	    shift
	    ;;
	-a=*|--aws-access-key=*)
	    export AWS_ACCESS_KEY_ID=${param#*=}
	    shift
	    ;;
	-s=*|--aws-secret-access-key=*)
	    export AWS_SECRET_ACCESS_KEY=${param#*=}
	    shift
	    ;;
    esac
done

if [ -z ${BASE_DIR} ] || [ -z ${UPLOAD_PLAN_PATH} ] || [ -z ${AAP_URL} ] || \
       [ -z ${AAP_USERNAME} ] || [ -z  ${AAP_PASSWORD} ] || [ -z ${AWS_ACCESS_KEY_ID} ] || [ -z  ${AWS_SECRET_ACCESS_KEY} ]; then
    echo "One of the required parameters is not provided."
    exit 1
fi

cd /app
node /app/dist/app.js
