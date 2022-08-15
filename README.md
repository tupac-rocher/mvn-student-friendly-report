
# mvn-student-friendly-report

This action treats information from files generated by different Maven plugins and dependencies. It ouputs a single variable of type String to visualize the information under the Markdown format.
The plugins are listed below:

- [jacoco-maven-plugin](https://www.eclemma.org/jacoco/trunk/doc/maven.html)
- [ck-mvn-plugin](https://github.com/jazzmuesli/ck-mvn-plugin)
- [JaSoMe](https://github.com/rodhilton/jasome)
- [Apache Maven Checkstyle Plugin](https://maven.apache.org/plugins/maven-checkstyle-plugin/)
- [DesigniteJava](https://github.com/tushartushar/DesigniteJava)

You can use it in your Github Actions workflow.

## Inputs

| File                    | Generated by | Description                                                    |
| ----------------------- | ------------ | - |
| `jacoco-html-report`    | Jacoco plugin |**Required** The file corresponding<br/>to the analysis of the test coverage:<br> - /target/site/jacoco/index.html
| `ck-main-class-csv`     | ck-mvn-plugin |**Required** The file corresponding<br/>to the analysis of the classes in the **main folder**:<br> - /src/main/java/class.csv |
| `metrics-xml`           | JaSoMe |**Required** The file corresponding<br/>to the analysis of the src folder:<br> - /metrics.xml |
| `checkstyle-result-xml` | Apache Maven Checkstyle Plugin |**Required** The <br/>file corresponding to the analysis of **code quality**:<br> - /target/checkstyle-result.xml |
| `designite-design-result-csv` |  DesigniteJava | **Required** The file corresponding<br/>to the analysis of **design smells**:<br> - /target/designite/designCodeSmells.csv |
| `designite-implementation-result-csv`| DesigniteJava | **Required** The file corresponding<br/>to the analysis of **implementation smells**:<br> - /target/designite/implementationCodeSmells.csv |

## Outputs

| Variable                | Description                                                    |   
| ----------------------- | -------------------------------------------------------------- |
| `report-comment` | A Markdown formatted String displaying the report composed of 4 categories:<br> - test coverage<br> - metrics<br> - code quality<br> - code smells |

## Example usage

Once you executed the goal of each plugin.

```yaml
      uses: tupac-rocher/mvn-student-friendly-report@v2.2
      with:
            jacoco-html-report: ${{ github.workspace }}/target/site/jacoco/index.html
            ck-main-class-csv: ${{ github.workspace }}/src/main/java/class.csv
            metrics-xml: ${{ github.workspace }}/metrics.xml
            checkstyle-result-xml: ${{ github.workspace }}/target/checkstyle-result.xml
            designite-design-result-csv: ${{ github.workspace }}/target/designite/designCodeSmells.csv
            designite-implementation-result-csv: ${{ github.workspace }}/target/designite/implementationCodeSmells.csv
```
---
## Student-friendly pipeline explanation and context of use
[Report Documentation](https://github.com/tupac-rocher/student-friendly-pipeline-documentation)

Your project should include 2 Maven plugins in the build tag of the pom.xml file:
- jacoco-maven-plugin (verion: 0.8.7, group-id: org.jacoco)
```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.7</version>
    <executions>
        <execution>
            <id>prepare-agent</id>
            <goals>
                <goal>prepare-agent</goal>
            </goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals>
                <goal>report</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```
The first goal, "prepare-agent", will prepare the JaCoCo runtime agent to record the execution data.<br>
The second goal, "report", will use the execution data recorded to generate code coverage reports.<br>
This second goal is tied to the "test" phase of the Maven lifecycle, this means that the goal will be trigger of the compilation of this phase.<br>
The test coverage report can be found at target/site/jacoco/index.html.

- maven-checkstyle-plugin (version: 3.1.2, group-id: org.apache.maven.plugins)

```xml
<plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-checkstyle-plugin</artifactId>
      <version>3.1.2</version>
      <configuration>
        <configLocation>checkstyle.xml</configLocation>
        <encoding>UTF-8</encoding>
      </configuration>
</plugin>
```
checkstyle.xml is the configuration file that describes the issues to report. You can download it [here](https://github.com/tupac-rocher/student-friendly-pipeline-documentation)

---

The pipeline is divided into 3 jobs:
- build
- upload-designite-artifact
- report

---
### **build**
**actions used**: actions/checkout@v3, actions/setup-java@v3

**description**: 

 
The purpose of this job is to allow the user to know directly if the code builds, tests pass and a package can be created before doing the other jobs.

---
### **upload-designite-artifact**
**actions used**: GuillaumeFalourd/clone-github-repo-action@v2, actions/upload-artifact@v3

**description**:

The purpose of this job is to upload the designite jar to execute the tool in the last job

---
### **report**
**actions used**: actions/checkout@v3, actions/setup-java@v3, actions/download-artifact@v3, robinraju/release-downloader@v1.4, montudor/action-zip@v1, tupac-rocher/mvn-student-friendly-report@v2.2, thollander/actions-comment-pull-request@v1

**description**: 

This job is the core of the pipeline. It will execute the Maven goals of the Maven plugins (jacoco-maven-plugin, maven-checkstyle-plugin) in order to generate the analytic files. 

It will download the Designite exectuable artifact and execute it against the project to generate the analytic files.

Regarding the metrics, to use CK it will clone its repository, since it is a Maven project it will install it, and finally execute its goal on the current project, this process is due to the way described by the CK README file to use the tool, eventually the analytic files are generated. 
To use the JaSoMe tool, the process is to download the release, unzip it and execute it against the project to generate the analytic files.

Now that all the files have been generated. The action corresponding to this repository will be used to aggregate and format the information into a single output that will represent a report in a Markdown formatted String variable.

The Markdown formatted String is used with an action that will comment the pull request.
