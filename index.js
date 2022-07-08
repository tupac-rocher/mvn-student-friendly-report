const core = require('@actions/core');
const github = require('@actions/github');

const xml2js = require('xml2js');
const fs = require('fs');
const csv = require('csv-parser')
const parser = new xml2js.Parser({ attrkey: "ATTR" });

// Format the file in a string format

const getStringFromFile = (file) => {
    var result = '\n' + file.ATTR.name + '\n\n'
    for(let error of file.error){
        const attributes = error.ATTR
        const line = attributes.line? attributes.line : ''
        const column = attributes.column? attributes.column : ''
        const message = attributes.message? attributes.message : ''
        const source = attributes.source? attributes.source : ''
        result += message + '\n' + source + '(' + line + ':' + column + ')\n\n'
    }
    return result
}

const getStringFromErrors = (errors) => {
    let formattedReport = "| Error Category | Error Type | Location | Message |\n"
    formattedReport += "| - | - | - | - |\n"
    errors.sort(
        function(a, b) {          
           if (a.errorCategory === b.errorCategory) {
              return a.errorType > b.errorType ? 1 : -1
           }
           return a.errorCategory > b.errorCategory ? 1 : -1;
        }
    );
    for(let error of errors){
        formattedReport += '| '+ error.errorCategory + ' | ' + error.errorType + ' | '
        formattedReport += error.fileName + ' ('+ error.line + ':' + error.column + ')'
        formattedReport += ' | ' + error.message + ' |\n' 
    }
    return formattedReport


}

const getFormattedFileObject = (file) => {
    const errors = []

    const fileName = file.ATTR.name.split('/java/')[1].replace(/\//g, ".")
    for (let error of file.error){
        const attributes = error.ATTR

        const newErrorData = {}
        newErrorData.fileName = fileName
        newErrorData.line = attributes.line
        newErrorData.column = attributes.column
        const source = attributes.source.split('.')
        newErrorData.errorCategory = source[5]
        newErrorData.errorType = source[6]
        newErrorData.message = attributes.message
        errors.push(newErrorData)
    }
    return errors
}

try {

    // Checkstyle file treatment
    //const checkstyleResultXml = 'checkstyle-result.xml'
    const checkstyleResultXml = core.getInput('checkstyle-result-xml')
    let xml_string = fs.readFileSync(checkstyleResultXml, "utf8");

    parser.parseString(xml_string, function(error, result) {
        if(error === null) {
            if(result.checkstyle){
                const report = result.checkstyle
                if(report.file){
                    let formattedReport = ""
                    let errors = []
                    if(Array.isArray(report.file)){
                        for(let file of report.file){
                            //formattedReport += getStringFromFile(file)
                            errors = errors.concat(getFormattedFileObject(file))
                        }
                    }
                    else{
                        formattedReport += getStringFromFile(file)
                        errors = errors.concat(getFormattedFileObject(file))
                    }
                    formattedReport = getStringFromErrors(errors)
                    formattedReport += '\n'
                    core.setOutput("checkstyle-comment", formattedReport);
                }
            }
        }
        else {
            core.setFailed(error.message);
        }
    });

    // Designite file treatment
    const designiteResultCsv = core.getInput('designite-result-csv')
    // const designiteResultCsv = "designCodeSmells.csv"
    const results = []
    fs.createReadStream(designiteResultCsv)
    .pipe(csv({}))
    .on('data', (data) => results.push(data))
    .on('end', () => {
        let formattedReport = ""
        for (let codeSmell of results){
            formattedReport += codeSmell['Project Name']
            formattedReport += codeSmell['Package Name']
            formattedReport += '.' + codeSmell['Type Name'] + '\n'
            formattedReport += codeSmell['Code Smell'] + '\n\n'
        }
        core.setOutput("designite-comment", formattedReport);
    })

    // CK files treatment

    const getStringFromCKFile = (file, isClass) => {
        let fileMetrics = ""
        fileMetrics += '| ' + file['class']  + (isClass? '' : ' | ' + file['method'].slice(0, -2) )
        fileMetrics += ' | ' + file['cbo'] + ' | ' + file['cboModified'] 
                     + ' | ' + file['fanin'] + ' | ' + file['fanout']
                     + ' | ' + file['dit'] + ' | ' + file['wmc']
        if(isClass){
            fileMetrics += ' | ' + file['totalFieldsQty'] + ' | ' + file['totalMethodsQty'] + ' |\n'
        }
        else {
            fileMetrics += ' | ' + file['parametersQty'] + ' |\n'
        }
        return fileMetrics
    }

    const readCSVPromise = (fileName, isClass) => {
        const stream = fs.createReadStream(fileName)
        let fileData = ""
        return new Promise((resolve) => {
            stream
                .pipe(csv({}))
                .on('data', function(data) {
                    fileData += getStringFromCKFile(data, isClass)
                })
                .on('end', function() {
                  resolve(fileData);
                });
          });
    }

    const outputCKComment = (mainFile, testFile, isClass) => {
        // wait until all files have been retrieved, then continue
        Promise.all(
            [
                readCSVPromise(mainFile, isClass),
                readCSVPromise(testFile, isClass)
            ]
        )
            .then(function (data) {

                // Header
                let ckFormattedComment = ""
                if(isClass){
                    // Class
                    ckFormattedComment += '### Classes\n'
                    ckFormattedComment += '| Class | CBO | CBO Modified | FAN-IN | FAN-OUT | DIT | WMC'
                    ckFormattedComment += ' | Total Fields Quantity | Total Methods Quantity |\n'
                }
                else {
                    // Method
                    ckFormattedComment += '### Methods\n'
                    ckFormattedComment += '| Class | Method | CBO | CBO Modified | FAN-IN | FAN-OUT | DIT | WMC'
                    ckFormattedComment += ' | Total Parameters Quantity |\n'
                }
                ckFormattedComment += ' | - | - | - | - | - | - | - | - | - |\n'
 
                for(fileStringify of data){
                    ckFormattedComment += fileStringify
                }
                ckFormattedComment += '\n'

               if(isClass){
                core.setOutput("ck-classes-comment", ckFormattedComment);
               }
               else {
                core.setOutput("ck-methods-comment", ckFormattedComment);

               }
        });
    }

    const classMainFile = core.getInput('ck-main-class-csv')
    const classTestFile = core.getInput('ck-test-class-csv')
    const methodMainFile = core.getInput('ck-main-method-csv')
    const methodTestFile = core.getInput('ck-test-method-csv')

    // const classMainFile = './main/class.csv'
    // const classTestFile = './test/class.csv'
    // const methodMainFile = './main/method.csv'
    // const methodTestFile = './test/method.csv'


    outputCKComment(classMainFile,classTestFile,true)
    outputCKComment(methodMainFile, methodTestFile, false)

} catch (error) {
    core.setFailed(error.message);
}