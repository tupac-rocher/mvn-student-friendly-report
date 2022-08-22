const { roundNumber } = require('./utils')
const fs = require('fs');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ attrkey: "ATTR" });
const csv = require('csv-parser')

/**
 * 
 * @param {[Object]} rawMetrics the raw data from the 'Metric' attribute of a method
 * from the XML file from the JaSoMe analysis (contains all the metrics from the method)
 * @returns {Object} the selected metrics of the method with the following structure
 * {
 *      TLOC: Number
 *      NOP: Number
 *      NBD: Number
 *      FIN: Number
 *      FOUT: Number
 *      CC: Number
 * }
 */
const getMethodMetrics = (rawMetrics) => {
    // Metrics of the Method
    const metricNames = ['VG','NOP','NBD','Fin','Fout', 'TLOC']
    const selectedMetrics = getSelectedMetric(rawMetrics, metricNames)

    const formattedMetrics = getKeyValueMetricObjects(selectedMetrics)

    let assembledMetrics = getAssembledMetrics(formattedMetrics)

    const methodMetrics = {
        TLOC: Number(assembledMetrics.TLOC),
        NOP: Number(assembledMetrics.NOP),
        NBD: Number(assembledMetrics.NBD),
        FIN: Number(assembledMetrics.Fin),
        FOUT: Number(assembledMetrics.Fout),
        CC: Number(assembledMetrics.VG)
    }

    return methodMetrics
}

/**
 * 
 * @param {Object} rawClass the raw class Object from the JaSoMe XML file
 * @param {String} location the location of the class file
 * @returns 
 * {
 *      location: String
 *      line: String
 *      name: String
 *      TLOC: Number
 *      NOP: Number
 *      NBD: Number
 *      FIN: Number
 *      FOUT: Number
 *      CC: Number
 *  }
 */
const getFormattedMethodFromClass = (rawClass, location) => {
    let classMethods = rawClass['Methods'][0]['Method']
    return classMethods.map((method) => {
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
}

/**
 * 
 * @param {[Object]} rawMetrics an Array of raw metrics from a class or a method from the JaSoMe XML file
 * @param {[String]} metricNames the names of the relevant metrics 
 * @returns {[Object]} an Array of raw metrics Object filetered with only the relevant ones
 */
const getSelectedMetric = (rawMetrics, metricNames) => {
    return rawMetrics.filter((metric) => {
        return metricNames.includes(metric.ATTR.name)
    })
}

/**
 * 
 * @param {[Object]} selectedMetrics raw metrics data selected from a class or a method 
 * from the JaSoMe XML file 
 * @returns {[Object]} an Array of Key-Value pair metric Object with the following structure
 * {
 *  *metric-name*: *metric-value*
 * }
 */
const getKeyValueMetricObjects = (selectedMetrics) => {
    return selectedMetrics.map((metric) => {
        return {
            [metric.ATTR.name] : metric.ATTR.value
        }
    })
}

/**
 * 
 * @param {[Object]} metrics list of Key-Value pair metric Object from a class or a method with the following structure
 * @returns {Object} an Object with each field corresponding to a metric
 *  {
 *  *metric-name*: *metric-value*
 *  *metric-name*: *metric-value*
 *  *metric-name*: *metric-value*
 *  *metric-name*: *metric-value*
 *  ...
 * }
 */
 const getAssembledMetrics = (metrics) => {
    let assembledMetrics = {}
    for(let metric of metrics){
        assembledMetrics = {
            ...assembledMetrics,
            ...metric
        }
    }
    return assembledMetrics
}

/**
 * 
 * @param {Object} rawClass the raw class Object from the JaSoMe XML file
 * @param {String} location the location of the class file
 * @returns {Object} the formatted data with the following structure
 * {
 *      location: String
 *      MIF: Number
 *      PA: Number
 *      MHF: Number
 *  }
 * 
 */
const getFormattedClass = (rawClass, location) => {

    // Selected metric names
    const metricNames = ['MIF','Av','PMd','Md']
    const rawMetrics = rawClass['Metrics'][0]['Metric']
    const selectedMetrics = getSelectedMetric(rawMetrics, metricNames)

    const metrics = getKeyValueMetricObjects(selectedMetrics)

    let assembledMetrics = getAssembledMetrics(metrics)

    // Final object
    newClass = {
        location: location,
        MIF: roundNumber(Number(assembledMetrics.MIF)),
        PA: Number(assembledMetrics.Av),
        MHF: roundNumber(Number(1 - (assembledMetrics.PMd / assembledMetrics.Md)))
    }
    return newClass
}

/**
 * 
 * @param {[Object]} data is the raw data from the XML file from the JaSoMe analysis
 * @returns {Object} with the following structure
 * {
 *      classes: [
 *          {
 *              location: String
 *              MIF: Number
 *              PA: Number
 *              MHF: Number
 *          }
 *      ]
 *      methods:
 *      [
 *          {
 *              location: String
 *              line: String
 *              name: String
 *              TLOC: Number
 *              NOP: Number
 *              NBD: Number
 *              FIN: Number
 *              FOUT: Number
 *              CC: Number
 *          }
 *      ]
 * }
 */
const getjasomeDataFormatted = (data) => {
    const project = data['Project']
    const classes = []
    let methods = []

    // Extract main classes
    for(let currentPackage of project['Packages'][0]['Package']){

        for(let currentClass of currentPackage['Classes'][0]['Class']){

            // Location
            const sourceFile = currentClass.ATTR.sourceFile
            // Format the raw location information
            const location = sourceFile.split('/java/')[1].replace(/\//g, ".").replace(/.java$/, '');

            // Class
            classes.push(getFormattedClass(currentClass, location))

            // Methods
            methods = methods.concat(getFormattedMethodFromClass(currentClass,location))
            
        }
    }
    return {
        classes: classes,
        methods: methods
    }
}

/**
 * 
 * @param {String} jasomeXMLFile the path to the corresponding XML file
 * @returns {Prommise} that resolves with an Array of Object representing methods with the following structure 
 * {
 *      location: String
 *      line: String
 *      name: String
 *      TLOC: Number
 *      NOP: Number
 *      NBD: Number
 *      FIN: Number
 *      FOUT: Number
 *      CC: Number
 * }
 */
const jasomeDataFormat = (jasomeXMLFile) => {
    return new Promise(function(resolve, reject){
        let metricsFile = fs.readFileSync(jasomeXMLFile, "utf8");
        parser.parseString(metricsFile, function(error, result) {
            if(error){
                reject(error);
                
            }
            else {
                const dataFormatted = getjasomeDataFormatted(result)
                resolve(dataFormatted);
            }
        })
    });
}

/**
 * 
 * @param {String} ckMainClassFile the path to the corresponding CSV file
 * @returns {Promise} that resolves with an Array of Object representing classes with the following structure
 * {
 *      location: String
 *      fanin: Number
 *      fanout: Number
 *      tcc: Number
 * }
 */
const ckMainClassDataFormat = (ckMainClassFile) => {
    const stream = fs.createReadStream(ckMainClassFile)
    let classes = []
    return new Promise((resolve) => {
        stream
            .pipe(csv({}))
            .on('data', function(data) {
                const newClass = {
                    location: data['class'],
                    fanin: Number(data['fanin']),
                    fanout: Number(data['fanout']),
                    tcc: roundNumber(Number(data['tcc']))
                }
                classes.push(newClass)
            })
            .on('end', function() {
                resolve(classes);
            });
        });

}

/**
 * 
 * @param {[Object]} classes an Array of Object representing classes with the following structure
 * {
 *      location: String
 *      fanin: Number
 *      fanout: Number
 *      tcc: Number
 *      MIF: Number
 *      PA: Number
 *      MHF: Number
 * }
 * @returns a Markdown formatted String that represents the class-level section 
 * from the design metric section of the report
 */
const getClassMetricsComment = (classes) => {
    let comment = ''
    // Ttitle
    comment += '### Classes\n'
    // Header
    comment += '| Class | FAN-IN | FAN-OUT | TCC | MIF | Public Attributes | MHF |\n'
    comment += ' | - | - | - | - | - | - | - |\n'
    for(let currentClass of classes){
        comment += currentClass.location + ' | ' + 
                    currentClass.fanin + ' | ' + 
                    currentClass.fanout + ' | ' + 
                    (isNaN(currentClass.tcc) ? 'Not enough methods' : currentClass.tcc) + ' | ' + 
                    currentClass.MIF + ' | ' + 
                    currentClass.PA + ' | ' + 
                    currentClass.MHF + ' |\n' 
    }
    return comment
}

/**
 * 
 * @param {[Object]} methods an Array of Object with the following structure
 * {
 *      location: String
 *      line: String
 *      name: String
 *      TLOC: Number
 *      NOP: Number
 *      NBD: Number
 *      FIN: Number
 *      FOUT: Number
 *      CC: Number
 * }
 * @returns {String} a Markdown formatted String that represents the method-level section 
 * from the design metric section of the report
 */
const getMethodMetricsComment = (methods) => {
    let comment = ''
    // Ttitle
    comment += '\n### Methods\n'
    // Header
    comment += '| Class | Method | FAN-IN | FAN-OUT | Total Lines of Code | NOP | NBD | McCabe Cyclomatic Complexity |\n'
    comment += ' | - | - | - | - | - | - | - | -  |\n'
    for(let currentMethod of methods){
        comment += currentMethod.location + ' | ' + 
                    currentMethod.name + ' | ' + 
                    currentMethod.FIN + ' | ' + 
                    currentMethod.FOUT + ' | ' + 
                    currentMethod.TLOC + ' | ' + 
                    currentMethod.NOP + ' | ' + 
                    currentMethod.NBD + ' | ' + 
                    currentMethod.CC + ' |\n' 
    }
    return comment
}

/**
 * 
 * @param {[Object]} ckData formatted ckData
 * @param {[Object]} jasomeData formatted jasomeData
 * @returns {[Object]} an Array of Object representing classes with the following structure
 * {
 *      location: String
 *      fanin: Number
 *      fanout: Number
 *      tcc: Number
 *      MIF: Number
 *      PA: Number
 *      MHF: Number
 * }
 */
const getMergedData = (ckData, jasomeData) => {
    return ckData.map((currentClass) => {
        const classToMerge = jasomeData.classes.find((currentJaSoMeClass) => {
            return currentJaSoMeClass.location === currentClass.location
        })
        const newClass = {
            ...currentClass,
            ...classToMerge
        }
        return newClass
    })
}

/**
 * 
 * @param {String} ckMainFile the path to the corresponding file
 * @param {String} metricsXMLFile the path to the corresponding file
 * @returns {Promise} that resolves with a Markdown formatted String that represents the design metric section of the report
 */
const getDesignMetricComment = (ckMainFile, metricsXMLFile) => {
    return new Promise((resolve, reject) => {
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

                // merge class data from jasome and ck
                const classes = getMergedData(ckData, jasomeData)

                const classMetricsComment = getClassMetricsComment(classes)
                const methodMetricsComment = getMethodMetricsComment(jasomeData.methods)
                
                const designMetricsFormattedComment = '## Design Metrics\n' + classMetricsComment + methodMetricsComment
                resolve(designMetricsFormattedComment)
        })
        .catch((error) => {
            reject(error)
        })
    })
}

module.exports = { getDesignMetricComment }