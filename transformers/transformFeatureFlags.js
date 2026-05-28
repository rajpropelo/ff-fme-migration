const fs = require("fs");

function transformFeatureFlags(filterProject) {
  const projects = JSON.parse(fs.readFileSync("./data/projects.json")).data
    .content;

  const projectIds = projects.map((project) => {
    return {
      project: project.project.identifier,
      org: project.project.orgIdentifier,
    };
  }).filter((element) => element.project.match(filterProject));
  for (const project of projectIds) {

    const environments = JSON.parse(
      fs.readFileSync(
        `./data/${project.org}/${project.project}/environments.json`
      )
    ).data.content;
    for (const env of environments) {
      const envId = env.environment.identifier;
      const featureFlags = JSON.parse(
        fs.readFileSync(
          `./data/${project.org}/${project.project}/${envId}/flags.json`
        )
      );
      for (const featureFlag of featureFlags) {
        let treatmentsMap = featureFlag.variations.map(
          (val, idx, ary) => {
          let kind = featureFlag.kind;
          let name, config, desc;
          if (kind == "boolean" || val.value == "true" || val.value == "false") {
            if (val.value == "true") {
              name = "on";
              desc = val.value;
              config = '';
            } else {
              name = "off";
              desc = val.value;
              config = '';
            }
          } else if (kind == "string" || kind == "int") {
            name = val.value ;
            desc = val.name;
            config = '';
          } else {
            name = val.identifier;
            desc = val.name;
            config = val.value;
          }
          if (name !== name.replace(/[^-_a-zA-Z0-9]/g, "_").replace(/\ball\b/gi, "all_").replace(/^_+/, '')) {
            console.warn(`Flag name ${featureFlag.identifier} treatment ${name} contains invalid characters and they will be stripped, if empty will be replaced with the string null. Other special strings will also be replaced`);
          }

            const treatmentName = name.replace(/[^-_a-zA-Z0-9]/g, "_").replace(/\ball\b/gi, "all_").replace(/^_+/, '');
            return {
            "name": treatmentName === "__" ? "null" : treatmentName,
            "configurations": config,
            "description": desc,
            };
        });
        let identityToValuesMap = featureFlag.variations.map((variation) => {
                  let kind = featureFlag.kind;
                  let value = (kind == 'boolean' || variation.value == "true" || variation.value == "false") ? variation.value == "true" ? "on" : "off" : kind == 'string' || kind == 'int' ? variation.value : variation.identifier;
                  value = value.replace(/[^-_a-zA-Z0-9]/g, "_").replace(/\ball\b/gi, "all_").replace(/^_+/, '');
                  return { 
                    identifier: variation.identifier,
                    value: value == "__" ? "null" : value
                  };
                });
        let harnessOpToSplitOp = {
          "starts_with": "STARTS_WITH_STRING",
          "ends_with": "ENDS_WITH_STRING",
          "equals": "IN_LIST_STRING",
          "equal": "IN_LIST_STRING",
          "equal_sensitive": "IN_LIST_STRING",
          "contains": "CONTAINS_STRING",
          "in": "IN_LIST_STRING",
        };
        let parentFlags = featureFlag.prerequisites.length == 0 ? null : featureFlag.prerequisites.map((prereq) => prereq.feature);
        let parentFlagsJSON = parentFlags == null ? null : featureFlags.filter((flag) => {
         return parentFlags.includes(flag.identifier);
        });

        let parentFlagVariations = parentFlagsJSON == null ? [] : parentFlagsJSON.flatMap((flag) => {
          return flag.variations.map((variation) => {
            let kind = flag.kind;
            let value = (kind == 'boolean' || variation.value == "true" || variation.value == "false") ? variation.value == "true" ? "on" : "off" : kind == 'string' || kind == 'int' ? variation.value : variation.identifier;
            value = value.replace(/[^-_a-zA-Z0-9]/g, "_").replace(/\ball\b/gi, "all_").replace(/^_+/, '');
            return { 
              flag: flag.identifier,
              identifier: variation.identifier,
              value: value == "__" ? "null" : value
            };
          });
        });
        let dependencies = featureFlag.prerequisites.length == 0 ? null :
          {
            "buckets": [
                {
                    "treatment": identityToValuesMap.find(item => item.identifier === featureFlag.defaultOffVariation).value,
                    "size": 100
                }
            ],
            "condition": {
                "combiner": "AND",
                "matchers": featureFlag.prerequisites.map((prereq) => (
                  {
                    "type": "IN_SPLIT",
                    "depends": {
                        "splitName": prereq.feature,
                        "treatments": prereq.variations.map((dep) => parentFlagVariations.find(item => item.identifier === dep && item.flag == prereq.feature).value) 
                    }
                }
                
                ))
        }
      };
      let segments = [];
  if( fs.existsSync(`./transformedData/${project.project}/${envId}/segments`)) {
    segments =  fs.readdirSync(`./transformedData/${project.project}/${envId}/segments`, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
  } 
if (fs.existsSync(`./transformedData/${project.project}/${envId}/rule-based-segments`)) {
  ruleBasedSegments = fs.readdirSync(`./transformedData/${project.project}/${envId}/rule-based-segments`, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name)
}

  let segmentRules = featureFlag.envProperties.rules?.flatMap((rule) => {
    return rule.clauses.flatMap((clause) => {
      return clause.values.filter((value) => (segments.includes(value) || ruleBasedSegments.includes(value))).map(value => {
        return {
          "buckets": (() => {
            if (typeof rule.serve.distribution == 'undefined') {

              return [{
                "treatment": identityToValuesMap.find(item => item.identifier === rule.serve.variation).value,
                "size": 100
              }];
            } else {
              return rule.serve.distribution.variations.map((variation) => {
                if(rule.serve.distribution.bucketBy !== 'identifier'){
                  console.warn(`Flag name ${featureFlag.identifier} with bucketBy other than identifier is not supported - will be mapped over as identifier`);
                }
                return {
                  "treatment": identityToValuesMap.find(item => item.identifier === variation.variation).value,
                  "size": variation.weight
                };
              });
            }
          })(),
          "condition": {
            "combiner": "AND",
            "matchers": [
              {
                "type": segments.includes(value) ? "IN_SEGMENT" : "IN_RULE_BASED_SEGMENT",
                "string": value,
                "negate": clause.negate
              }
            ]
          }
        };
      });
    });
  });

  // no longer needed due to new support for rule based segments
// // have to handle the case of attribute, include, and exclude
//   let dynamicSegmentInclude = featureFlag.envProperties.rules?.flatMap((rule) => {
//     return rule.clauses.flatMap((clause) => {
//       return clause.values.filter((value) => (!segments.includes(value))).flatMap(value => {
//         let segment = JSON.parse(fs.readFileSync(`./data/${project.org}/${project.project}/${envId}/targetGroups.json`)).find((segment) => segment.identifier === value);
//         return segment.rules.flatMap((segmentRule) => {
//           if (segmentRule.op == 'equals'){
//             console.warn(`Flag name ${featureFlag.identifier} with equals operator mapped over as case sensitive string match`);
//           }
//           let matchers = {
//             "type": "IN_LIST_STRING",
//             "strings": segment.included.map((include) => include.identifier),
//             "negate": false
//           }
//           if(matchers.length > 0) {
//             return {
//             "buckets": (() => {
//               if (typeof rule.serve.distribution == 'undefined') {
//               return [{
//                 "treatment": identityToValuesMap.find(item => item.identifier === rule.serve.variation).value,
//                 "size": 100
//               }];
//               } else {
//               return rule.serve.distribution.variations.map((variation) => {
//                 if(rule.serve.distribution.bucketBy !== 'identifier'){
//                 console.warn(`Flag name ${featureFlag.identifier} with bucketBy other than identifier is not supported - will be mapped over as identifier`);
//                 }
//                 return {
//                 "treatment": identityToValuesMap.find(item => item.identifier === variation.variation).value,
//                 "size": variation.weight
//                 };
//               });
//               }
//             })(),
//             "condition": {
//               "combiner": "AND",
//                "matchers": matchers
//                // [
//               // // {
//               // //   "type": harnessOpToSplitOp[segmentRule.op],
//               // //   "attribute": segmentRule.attribute,
//               // //   "strings": segmentRule.values,
//               // //   "negate": segmentRule.negate
//               // // },
//               // // ...(segment.included?.length ? [{
//               // //   "type": "IN_LIST_STRING",
//               // //   "strings": segment.included.map((include) => include.identifier),
//               // //   "negate": false
//               // // }] : []),
//               // // ...(segment.exclude?.length ? [{
//               // //   "type": "IN_LIST_STRING",
//               // //   "strings": segment.exclude.map((exclude) => exclude.identifier),
//               // //   "negate": true
//               // // }] : [])
//               // ]
//             }
//             };
//         } else {
//           return []
//       }});
//       });
//     });
//   });

  let attributeTargeting = featureFlag.envProperties.rules?.flatMap((rule) => {
    return rule.clauses.flatMap((clause) => {
      return clause.values.filter((value) => (!segments.includes(value))).flatMap(value => {
        let segment = JSON.parse(fs.readFileSync(`./data/${project.org}/${project.project}/${envId}/targetGroups.json`)).find((segment) => segment.identifier === value);
        return segment.rules.flatMap((segmentRule) => {
          if (segmentRule.op == 'equals'){
            console.warn('equals operator mapped over as case sensitive string match');
          }
          if(segmentRule.attribute == 'identifier' && segmentRule.op !== 'in' && segmentRule.op !== 'segmentMatch'){
            console.warn(
              `Flag name ${featureFlag.identifier} with identifier rules of ${segmentRule.op} - limited support IN_LIST and NOT_IN_LIST in FME - all other rules will be mapped over as IN_LIST`
            )
          }
            return {
            "buckets": (() => {
              if (typeof rule.serve.distribution == 'undefined') {
              return [{
                "treatment": identityToValuesMap.find(item => item.identifier === rule.serve.variation).value,
                "size": 100
              }];
              } else {
              return rule.serve.distribution.variations.map((variation) => {
                if(rule.serve.distribution.bucketBy !== 'identifier'){
                console.warn(`Flag name ${featureFlag.identifier} has bucketBy other than identifier - this is not supported - will be mapped over as identifier`);
                }
                return {
                "treatment": identityToValuesMap.find(item => item.identifier === variation.variation).value,
                "size": variation.weight
                };
              });
              }
            })(),
            "condition": {
              "combiner": "AND",
              "matchers": [
              {
              "type": (segmentRule.attribute !== 'identifier' ? harnessOpToSplitOp[segmentRule.op] : 'IN_LIST_STRING'),
              ...(segmentRule.attribute !== 'identifier' && { "attribute": segmentRule.attribute }),
              "strings": segmentRule.values,
              "negate": segmentRule.negate
              },
              // ...(segment.included?.length ? [{
              //   "type": "IN_LIST_STRING",
              //   "strings": segment.included.map((include) => include.identifier),
              //   "negate": false
              // }] : []),
              ...(segment.exclude?.length ? [{
                "type": "IN_LIST_STRING",
                "strings": segment.exclude.map((exclude) => exclude.identifier),
                "negate": true
              }] : [])
              ]
            }
            };
        });
      });
    });
  });



        let keyRules = featureFlag.envProperties.variationMap?.map((variation) => (
          {
            "buckets": [
                {
                    "treatment": identityToValuesMap.find(item => item.identifier === variation.variation).value,
                    "size": 100
                }
            ],
            "condition": {
                "combiner": "AND",
                "matchers": [
                    {
                        "type": "IN_LIST_STRING",
                        "strings": variation.targets.map((target) => target.identifier),
                    }
                ]
            }
        }
        ));
        let flag = {
          name: featureFlag.identifier,
          description: featureFlag.description,
        };

        let flagDef = {
          "treatments": treatmentsMap,
          "defaultTreatment": identityToValuesMap.find(item => item.identifier === featureFlag.defaultOffVariation).value,
          "baselineTreatment": identityToValuesMap.find(item => item.identifier === featureFlag.defaultOffVariation).value,
          "killed": (featureFlag.envProperties.state == 'off'),
          "rules": [].concat(dependencies, keyRules, segmentRules, attributeTargeting)
            .filter((rule) => rule != null)
            ,//.filter(rule => rule.condition.matchers.length > 0),
          "defaultRule": [
            { "treatment": identityToValuesMap.find(item => item.identifier === featureFlag.defaultOnVariation).value , "size": 100 }
          ],
          "comment": "updated by harness transformer"
        };
        let tags = featureFlag.tags?.map((tag) => tag.identifier);

          const dir = `./transformedData/${project.project}/${envId}/flags/${flag.name}`;
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // Save transformed data
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/flags/${flag.name}/flag.json`,
            JSON.stringify(flag, null, 2)
          );
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/flags/${flag.name}/flagDef.json`,
            JSON.stringify(flagDef, null, 2)
          );
          if(typeof tags !== 'undefined' && tags.length > 0) {
          fs.writeFileSync(
            `./transformedData/${project.project}/${envId}/flags/${flag.name}/tags.json`,
            JSON.stringify(tags, null, 2)
          );
        }
          console.log(
            `Flag  ${flag.name} for ${envId} from project ${project.project} transformed and saved`
          );
        
      }
    }
  }
}


module.exports = transformFeatureFlags;
