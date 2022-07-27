const core = require('@actions/core');
const github = require('@actions/github');

const xml2js = require('xml2js');
const fs = require('fs');
const csv = require('csv-parser')
const parser = new xml2js.Parser({ attrkey: "ATTR" });
const HTMLParser = require('node-html-parser');

// Test Coverage
const jacocoHtmlReport = core.getInput('jacoco-html-report')
fs.readFile(jacocoHtmlReport, 'utf8', function(err, html){
    const root = HTMLParser.parse(html)
    const testCoverage = root.querySelector('#c0').childNodes[0]._rawText
    core.setOutput("test-coverage-comment", testCoverage);
})

// ------

const getStringFromErrors = (errors) => {
    let errorsComment = ""
    let errorNames = errors.map((error) => {
        return error.errorType
    })
    errorNames = [... new Set(errorNames)]
    for (let currentError of errorNames){
        errorsComment += '\n\n### ' + currentError + '\n'
        const currentErrors = errors.filter((error) => {
            if(currentError === error.errorType){
                errorsComment += '- ' + error.fileName + ' ('+ error.line + ':' + error.column + ')\n'
                return error
            }
        })
    }
    return errorsComment
}

const getFormattedFileObject = (file) => {
    const errors = []

    const fileName = file.ATTR.name.split('/java/')[1].replace(/\//g, ".")
    for (let error of file.error){
        const attributes = error.ATTR

        const newErrorData = {}
        newErrorData.fileName = fileName
        newErrorData.line = attributes.line? attributes.line : '0'
        newErrorData.column = attributes.column? attributes.column : '0'
        const source = attributes.source.split('.')
        const errorType = source[6]
        // add whitespaces
        .replace(/([A-Z])/g, ' $1')
        // uppercase the first character
        .replace(/^./, function(str){ return str.toUpperCase(); })
        // remove the ending 'Check'
        .replace("Check", "")
        newErrorData.errorType = errorType
        newErrorData.message = attributes.message
        errors.push(newErrorData)
    }
    return errors
}

try {

    // Checkstyle file treatment
    // const checkstyleResultXml = 'checkstyle-result.xml'
    const checkstyleResultXml = core.getInput('checkstyle-result-xml')
    let xml_string = fs.readFileSync(checkstyleResultXml, "utf8");

    parser.parseString(xml_string, function(error, result) {
        if(error === null) {
            if(result.checkstyle){
                const report = result.checkstyle
                if(report.file){
                    let checkstyleFormattedComment = ""
                    let errors = []
                    if(Array.isArray(report.file)){
                        for(let file of report.file){
                            errors = errors.concat(getFormattedFileObject(file))
                        }
                    }
                    else{
                        errors = errors.concat(getFormattedFileObject(file))
                    }
                    checkstyleFormattedComment = getStringFromErrors(errors)
                    checkstyleFormattedComment += '\n'
                    core.setOutput("checkstyle-comment", checkstyleFormattedComment);
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
        let designiteFormattedComment = ""
        let codeSmells = [... new Set(results.map((result) => result['Code Smell']))]
        for(let codeSmell of codeSmells){
            designiteFormattedComment += '\n\n### ' + codeSmell + '\n'
            for(let result of results){
                // remove first '.'
                const projectName =  result['Project Name'].slice(1)
                designiteFormattedComment += '- ' + projectName
                designiteFormattedComment += result['Package Name']
                designiteFormattedComment += '.' + result['Type Name'] + '\n'            }
        }
        core.setOutput("designite-comment", designiteFormattedComment);
    })

    // CK files treatment

    const getStringFromCKFile = (file, isClass) => {
        let fileMetrics = ""
        fileMetrics += '| ' + file['class']  + (isClass? '' : ' | ' + file['method'].slice(0, -2) )
        fileMetrics += ' | ' + file['cbo'] + ' | ' + file['cboModified'] 
                     + ' | ' + file['fanin'] + ' | ' + file['fanout']
                     + ' | ' + file['dit'] + ' | ' + file['wmc']
        
        // Class
        if(isClass){
            fileMetrics += ' | ' + file['totalFieldsQty'] + ' | ' + file['totalMethodsQty'] + ' |\n'
        }

        // Method
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