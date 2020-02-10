Upload and check file command plugin
---

Config example:
````
"@voicenter/voicenter_pastash_command_fileupload": {
    "pluginFieldName": "FieTransfer",
    "inputFileField": "sourceFilePath",
    "outputFileField": "destFilePath",
    "nameField": "fileName",
    "sizeField": "fileSize",
    "host": "host",
    "user": "username",
    "password": "password",
    "port": "port"
}
````

Commands list:
````
uploadFile();
````