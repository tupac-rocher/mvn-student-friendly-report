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

    // `checkstyle-result-xml` input defined in action metadata file

    const checkstyleResultXml = core.getInput('checkstyle-result-xml')

    // Reading XML file
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
                    core.setOutput("checkstyle-result-string", formattedReport);
                }
            }
        }
        else {
            core.setFailed(error.message);
        }
    });
} catch (error) {
    core.setFailed(error.message);
}