const core = require('@actions/core');
const github = require('@actions/github');

const xml2js = require('xml2js');
const fs = require('fs');
const csv = require('csv-parser')
const parser = new xml2js.Parser({ attrkey: "ATTR" });
const HTMLParser = require('node-html-parser');

// Test Coverage
const jacocoHtmlReport = core.getInput('jacoco-html-report')
// const jacocoHtmlReport = 'target/site/jacoco/index.html'
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

    // Metrics treatment

    const classMainFile = core.getInput('ck-main-class-csv')
    // const classMainFile = './main/class.csv'

    const metricsXML = core.getInput('metrics-xml')
    // const metricsXML = "metrics.xml"

    // Returns the select metrics for the methods from JaSoMe
    const getMethodMetrics = (metrics) => {
        // Metrics of the Method
        const metricNames = ['VG','NOP','NBD','Fin','Fout', 'TLOC']
        const selectedMetrics = metrics.filter((metric) => {
            return metricNames.includes(metric.ATTR.name)
        })

        const formattedMetrics = selectedMetrics.map((metric) => {
            return {
                [metric.ATTR.name] : metric.ATTR.value
            }
        })

        let assembledMetrics = {}

        for(let metric of formattedMetrics){
            assembledMetrics = {
                ...assembledMetrics,
                ...metric
            }
        }
        const methodMetrics = {
            TLOC: assembledMetrics.TLOC,
            NOP: assembledMetrics.NOP,
            NBD: assembledMetrics.NBD,
            FIN: assembledMetrics.Fin,
            FOUT: assembledMetrics.Fout,
            CC: assembledMetrics.VG
        }

        return methodMetrics
    }

    // Returns the classes and the methods with the selected metrics from JaSoMe
    const getjasomeDataFormatted = (data) => {

        const project = data['Project']
        const classes = []
        let methods = []

        // Extract main classes
        for(let currentPackage of project['Packages'][0]['Package']){

            for(let currentClass of currentPackage['Classes'][0]['Class']){
                // Only classes from the main folder
                if(!currentClass.ATTR.sourceFile.startsWith('./test')){

                    // Class

                    // Location
                    const sourceFile = currentClass.ATTR.sourceFile
                    const location = sourceFile.split('/java/')[1].replace(/\//g, ".").replace(/.java$/, '');

                    let newClass = {
                        location: location
                    }

                    // Metrics of the Class
                    const metricNames = ['AIF','MIF','Av','PMd','Md']
                    const metricsSelected = currentClass['Metrics'][0]['Metric'].filter((metric) => {
                        return metricNames.includes(metric.ATTR.name)
                    })

                    const metrics = metricsSelected.map((metric) => {
                        return {
                            [metric.ATTR.name] : metric.ATTR.value
                        }
                    })

                    let assembledMetrics = {}

                    for(let metric of metrics){
                        assembledMetrics = {
                            ...assembledMetrics,
                            ...metric
                        }
                    }

                    // Final object
                    newClass = {
                        ...newClass,
                        AIF: assembledMetrics.AIF,
                        MIF: assembledMetrics.MIF,
                        PA: assembledMetrics.Av,
                        MHF: 1 - (assembledMetrics.PMd / assembledMetrics.Md)
                    }
                    classes.push(newClass)

                    // Methods

                    let classMethods = currentClass['Methods'][0]['Method']
                    classMethods = classMethods.map((method) => {
                        const metricsToTreat = method['Metrics'][0]['Metric']
                        const metrics = getMethodMetrics(metricsToTreat)
                        const newMethod = {
                            location: location,
                            line: method.ATTR.lineStart,
                            name: method.ATTR.name,
                            ...metrics
                        }
                        return newMethod
                    })
                    methods = methods.concat(classMethods)
                }
            }
        }
        return {
            classes: classes,
            methods: methods
        }
    }

    // Returns the classes and the methods with the selected metrics from JaSoMe out of a Promise
    const jasomeDataFormat = (jasomeXMLFile) => {
        return new Promise(function(resolve, reject){
            let metricsFile = fs.readFileSync(jasomeXMLFile, "utf8");
            parser.parseString(metricsFile, function(error, result) {
                if(error){
                    core.setFailed(error.message);
                    reject(error);
                    
                }
                else {
                    const dataFormatted = getjasomeDataFormatted(result)
                    resolve(dataFormatted);
                }
            })
        });
    }

    // Returns the classes with the selected metrics from CK out of Promise
    const ckMainClassDataFormat = (ckMainClassFile) => {
        const stream = fs.createReadStream(ckMainClassFile)
        let classes = []
        return new Promise((resolve) => {
            stream
                .pipe(csv({}))
                .on('data', function(data) {
                    const newClass = {
                        location: data['class'],
                        fanin: data['fanin'],
                        fanout: data['fanout'],
                        tcc: data['tcc']
                    }
                    classes.push(newClass)
                })
                .on('end', function() {
                  resolve(classes);
                });
          });

    }

    // Returns a formatted String to output the metrics of each class
    const getClassMetricsComment = (classes) => {
        let comment = ''
        // Ttitle
        comment += '### Classes\n'
        // Header
        comment += '| Class | FAN-IN | FAN-OUT | TCC | AIF | MIF | Public Attributes | MHF |\n'
        comment += ' | - | - | - | - | - | - | - | -  |\n'
        for(let currentClass of classes){
            comment += currentClass.location + ' | ' + 
                       currentClass.fanin + ' | ' + 
                       currentClass.fanout + ' | ' + 
                       currentClass.tcc + ' | ' + 
                       currentClass.AIF + ' | ' + 
                       currentClass.MIF + ' | ' + 
                       currentClass.PA + ' | ' + 
                       currentClass.MHF + ' |\n' 
        }
        return comment
    }

    // Returns a formatted String to output the metrics of each method
    const getMethodMetricsComment = (methods) => {

        let comment = ''
        // Ttitle
        comment += '### Methods\n'
        // Header
        comment += '| Class | Method | Total Line of Code | NOP | NBD | FAN-IN | FAN-OUT | McCabe Cyclomatic Complexity |\n'
        comment += ' | - | - | - | - | - | - | - | -  |\n'
        for(let currentMethod of methods){
            comment += currentMethod.location + ' | ' + 
                       currentMethod.name + ' | ' + 
                       currentMethod.TLOC + ' | ' + 
                       currentMethod.NOP + ' | ' + 
                       currentMethod.NBD + ' | ' + 
                       currentMethod.FIN + ' | ' + 
                       currentMethod.FOUT + ' | ' + 
                       currentMethod.CC + ' |\n' 
        }
        return comment

    }

    const outputMetricComment = (metricsXMLFile, ckMainFile) => {
        // wait until all formatted data have been retrieved, then continue
        Promise.all(
            [
                jasomeDataFormat(metricsXMLFile),
                ckMainClassDataFormat(ckMainFile)
            ]
        )
            .then(function (data) {                
                const jasomeData = data[0]
                const ckData = data[1]

                // merge classes
                const classes = ckData.map((currentClass) => {
                    const classToMerge = jasomeData.classes.find((currentJaSoMeClass) => {
                        return currentJaSoMeClass.location === currentClass.location
                    })
                    const newClass = {
                        ...currentClass,
                        ...classToMerge
                    }
                    return newClass
                })

                const classMetricsComment = getClassMetricsComment(classes)
                const methodMetricsComment = getMethodMetricsComment(jasomeData.methods)
                
                const metricsFormattedComment = classMetricsComment + methodMetricsComment
                core.setOutput("metrics-comment", metricsFormattedComment);
   
        });
    }

    outputMetricComment(metricsXML, classMainFile)

} catch (error) {
    core.setFailed(error.message);
}