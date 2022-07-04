const core = require('@actions/core');
const github = require('@actions/github');

const xml2js = require('xml2js');
const fs = require('fs');
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

try {

    // Checkstyle file treatment
    const checkstyleResultXml = core.getInput('checkstyle-result-xml')
    let xml_string = fs.readFileSync(checkstyleResultXml, "utf8");

    parser.parseString(xml_string, function(error, result) {
        if(error === null) {
            if(result.checkstyle){
                const report = result.checkstyle
                if(report.file){
                    let formattedReport = ""
                    if(Array.isArray(report.file)){
                        for(let file of report.file){
                            formattedReport += getStringFromFile(file)
                        }
                    }
                    else{
                        formattedReport += getStringFromFile(file)
                    }
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
    const csv = require('csv-parser')
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
        fileMetrics += '##### ' + file['class'] + '\n---\n'
        if(!isClass){
            fileMetrics += '###### ' + file['method'] + '\n--\n'
        }
        fileMetrics += '| Metric | Value |\n'
        fileMetrics += '| - | - |\n'
        fileMetrics += '| CBO | ' + file['cbo'] + ' |\n'
        fileMetrics += '| CBO Modified | ' + file['cboModified'] + ' |\n'
        fileMetrics += '| FAN-IN | ' + file['fanin'] + ' |\n'
        fileMetrics += '| FAN-OUT | ' + file['fanout'] + ' |\n'
        fileMetrics += '| DIT | ' + file['dit'] + ' |\n'
        fileMetrics += '| WMC | ' + file['wmc'] + ' |\n'
        if(isClass){
            fileMetrics += '| Total Fields Quantity | ' + file['totalFieldsQty'] + ' |\n'
            fileMetrics += '| Total Methods Quantity | ' + file['totalMethodsQty'] + ' |\n\n'
        }
        else {
            fileMetrics += '| Total Parameters Quantity | ' + file['parametersQty'] + ' |\n\n'
        }
        return fileMetrics
    }

    const classMainFile = core.getInput('ck-main-class-csv')
    const resultsCKMainClass = []
    fs.createReadStream(classMainFile)
    .pipe(csv({}))
    .on('data', (data) => resultsCKMainClass.push(data))
    .on('end', () => {
        let ckFormattedMainClassFile = '### Main Classes\n'
        for (let file of resultsCKMainClass){
            ckFormattedMainClassFile += getStringFromCKFile(file,true)
        }
        console.log(ckFormattedMainClassFile)
        core.setOutput("ck-main-class", ckFormattedMainClassFile);
    })

    const methodMainFile = core.getInput('ck-main-method-csv')
    const resultsCKMainMethod = []
    fs.createReadStream(methodMainFile)
    .pipe(csv({}))
    .on('data', (data) => resultsCKMainMethod.push(data))
    .on('end', () => {
        let ckFormattedMainMethodFile = '#### Main Methods\n'
        for (let file of resultsCKMainMethod){
            ckFormattedMainMethodFile += getStringFromCKFile(file,false)
        }
        console.log(ckFormattedMainMethodFile)
        core.setOutput("ck-main-method", ckFormattedMainMethodFile);
    })

    const classTestFile = core.getInput('ck-test-class-csv')
    const resultsCKTestClass = []
    fs.createReadStream(classTestFile)
    .pipe(csv({}))
    .on('data', (data) => resultsCKTestClass.push(data))
    .on('end', () => {
        let ckFormattedTestClassFile = '#### Test Classes\n'
        for (let file of resultsCKTestClass){
            ckFormattedTestClassFile += getStringFromCKFile(file,true)
        }
        console.log(ckFormattedTestClassFile)
        core.setOutput("ck-test-class", ckFormattedTestClassFile);
    })

    const methodTestFile = core.getInput('ck-test-method-csv')

    const resultsCKTestMethod = []
    fs.createReadStream(methodTestFile)
    .pipe(csv({}))
    .on('data', (data) => resultsCKTestMethod.push(data))
    .on('end', () => {
        let ckFormattedTestMethodFile = '#### Test Methods\n'
        for (let file of resultsCKTestMethod){
            ckFormattedTestMethodFile += getStringFromCKFile(file,false)
        }
        console.log(ckFormattedTestMethodFile)
        core.setOutput("ck-test-method", ckFormattedTestMethodFile);
    })



} catch (error) {
    core.setFailed(error.message);
}