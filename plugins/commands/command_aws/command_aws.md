S3 Functions
---

Config example:
````
"@voicenter/voicenter_pastash_command_aws": {
    "pluginFieldName": "FileFetch",
    "outputFileField": "destFilePath",
    "nameField": "fileName",
    "bucketField": "fetchBucket",
    "buckets": {
        "fetchBucket": {
            "accessKeyId": "KEY_ID",
            "secretAccessKey": "KEY"
        }
    }
}
````

Commands list:
````
s3Fetch();
s3Delete();
````