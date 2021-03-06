var fso = new ActiveXObject("Scripting.FileSystemObject");
var logfileName = null;
var terminalOutcome = 0; // 0 - unknown, 1 = success, -1 = failure
var logContainsError = 0; // count the occurances of 'rror' in output
	
// needed for recursive structures...
var instanceBody = '';
var bindBody = '';
var bodyBody = '';

function init() { 
	var X=800;
	var Y=800;
	window.resizeTo(X,Y);
	window.moveTo( (screen.width - X)/2, (screen.height - Y) / 2 );
	formDirName.focus();
}

window.onload = init;

function reset() {
	document.getElementById('hideable').style.display = 'inline';
	document.getElementById('showable').style.display = 'none';
	document.getElementById('leftButton').innerHTML = '<input type="button" onClick="generate()" value="Generate">';
	document.getElementById('rightButton').innerHTML = '<input type="button" onClick="window.close()" value="Cancel">';
}

function wlog(logString) {
	if ( window.logfileName == null ) {
		var cd=fso.GetAbsolutePathName(".");
		window.logfileName = cd + '\\output.log';
		if ( fso.FileExists(window.logfileName) ) {
			fso.DeleteFile(window.logfileName);
		}
	}
    var file;
	// create empty output file
	if ( fso.FileExists(window.logfileName) ) {
		file = fso.OpenTextFile(window.logfileName,8,false,-1);
	} else {
		file = fso.CreateTextFile(window.logfileName,true,true);
	}
	file.WriteLine(logString);
	file.Close();
}

function generate() {
	if ( formDirName.value == "" ) {
		alert("ERROR: Please enter a Forms directory name");
		formDirName.focus();
		return;
	}
	
	if ( !fso.FolderExists(formDirName.value) ) {
		alert("ERROR: Forms directory could not be opened. Please change the Forms directory name");
		formDirName.focus();
		return;
	}
	
	window.formDirPath = formDirName.value;
	wlog("scheduling processing for: " + formDirPath);

	document.getElementById('output').innerHTML = '';
	document.getElementById('hideable').style.display = 'none';
	document.getElementById('showable').style.display = 'inline';
	document.getElementById('changeable').innerHTML = "Conversion progress:";
	document.getElementById('leftButton').innerHTML = '<input type="button" onClick="generate()" value="Generate">';
	document.getElementById('leftButton').disabled = true;
	document.getElementById('rightButton').innerHTML = '<input type="button" onClick="window.close()" value="Close">';
	window.setTimeout(doExec,2000);
}

function fetchMoreOutput() {
	var output = "";
	if ( window.logfile != null ) {
		while ( !window.logfile.AtEndOfStream ) {
			var line = window.logfile.ReadLine();
			if ( line.indexOf('rror:') != -1 ) {
				logContainsError = logContainsError + 1;
				line = "<font color='red'>" + line + "</font>";
			}
			output = output + line + "<br/>";
		}
		return output;
	} else {
		window.terminalOutcome = -1;
	}
	return output;
}

function continueWaitingForCompletion() {
	var newOutput = fetchMoreOutput();
	var preElement = document.getElementById('output');
	var output = preElement.innerHTML;
	output = output + newOutput;
	preElement.innerHTML = output;
	// adjust scrolling to show last line of output...
	var sh = preElement.scrollHeight;
	if ( sh > 0 ) {
		preElement.scrollTop = sh;
	} else {
		preElement.scrollTop = preElement.offsetHeight;
	}
	if ( window.terminalOutcome == 0 ) {
		setTimeout(continueWaitingForCompletion,10);
	} else {
		if ( logContainsError > 0 ) {
			output = output + '<font color="red">FAILURE!</font><br/>';
		} else {
			output = output + '<font color="green">SUCCESS!</font><br/>';
		}
		preElement.innerHTML = output;
		// adjust scrolling to show last line of output...
		var sh = preElement.scrollHeight;
		if ( sh > 0 ) {
			preElement.scrollTop = sh;
		} else {
			preElement.scrollTop = preElement.offsetHeight;
		}
		if ( window.terminalOutcome == 1 && logContainsError > 0 ) {
			document.getElementById('leftButton').innerHTML = '';
		} else {
			document.getElementById('leftButton').disabled = false;
		}
	}
}
	
function buildFormStructures( instanceBodyPrefix, bindPrefix, bodyPrefix, model ) { 
	var enames = [];
	var i, element, defn;
	var contentType, bindPrefix2, bodyPrefix2; 
	for ( element in model ) {
		enames.push(element);
	}
	enames.sort();
	for ( i = 0 ; i < enames.length ; ++i ) {
		element = enames[i];
		wlog("element: " + element);
		defn = model[element];
		
		if ( defn.type == "string" ) {
			instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
			bindBody += bindPrefix + element + '" type="string"/>\n';
		} else if ( defn.type == "integer" ) {
			instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
			bindBody += bindPrefix + element + '" type="int"/>\n';
		} else if ( defn.type == "number" ) {
			instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
			bindBody += bindPrefix + element + '" type="decimal"/>\n';
		} else if ( defn.type == "array" ) {
			instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
			bindBody += bindPrefix + element + '" type="select"/>\n';
		} else if ( defn.type == "object" ) {
			if ( defn.elementType == "date" ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				bindBody += bindPrefix + element + '" type="date"/>\n';
			} else if ( defn.elementType == "datetime" ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				bindBody += bindPrefix + element + '" type="datetime"/>\n';
			} else if ( defn.elementType == "time" ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				bindBody += bindPrefix + element + '" type="time"/>\n';
			} else if ( defn.elementType == "geopoint" ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				bindBody += bindPrefix + element + '" type="geopoint"/>\n';
			} else if ( defn.elementType == "mimeUri" ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				contentType = defn.properties.contentType['default'];
				bindBody += bindPrefix + element + '" type="binary"/>\n';
				bodyBody += '<upload ref="' + bodyPrefix + element + '" mediatype="' + contentType + '"><label>Dummy</label></upload>\n';
			} else if ( defn.isPersisted ) {
				instanceBody = instanceBody + instanceBodyPrefix + element + '/>\n';
				bindBody += bindPrefix + element + '" type="string"/>\n';
			} else {
				// it is a recursive structure
				bindPrefix2 = bindPrefix + element + '/';
				bodyPrefix2 = bodyPrefix + element + '/';
				instanceBody = instanceBody + instanceBodyPrefix + element + '>\n';
				buildFormStructures( '  ' + instanceBodyPrefix, bindPrefix2, bodyPrefix2, defn.properties );
				instanceBody = instanceBody + instanceBodyPrefix + '/' + element + '>\n';
			}
		}
	}
}

function execFormChange( idxSubfolder ) {
	
	var formsDir = fso.GetFolder(window.formDirPath);
	var subfolders = formsDir.SubFolders;

	var i = 0;
	var subfolderName = null;
	for(var objEnum = new Enumerator(subfolders); !objEnum.atEnd(); objEnum.moveNext()) {
		if ( i == idxSubfolder ) {
			subfolderName = objEnum.item();
			break;
		}
		++i;
	}

	delete objEnum;
	objEnum = null;
	
	subfolders = null;
	formsDir = null;
	wlog("execFormChange: subdirectory: " + idxSubfolder + " matches subfolder: " + subfolderName );
	try {
		if ( subfolderName != null ) {
			var name = subfolderName.Name;
			var idx = name.lastIndexOf("-media");
			if ( idx != -1 ) {
				wlog("processing media subdirectory: " + name);
				var formDefFile = window.formDirPath + "\\" + name + "\\formDef.json";
				
				if ( fso.FileExists(formDefFile) ) {
					var xmlName = window.formDirPath + "\\" + name.substring(0,idx) + ".xml";

					wlog("reading formDef file: " + formDefFile);
					
					var inStream = fso.OpenTextFile(formDefFile, 1, false, -2);
					var formDef = inStream.ReadAll();
					inStream.Close();
					
					wlog("start of formDef file: " + formDef.substring(0,40));
					try {
						var jsonDef = JSON.parse(formDef);
						wlog("processing json file: " + formDefFile);
						
						var settings = jsonDef.settings;
						var formId, tableId, formVersion = null, formTitle, defaultLocale = null;
						var xmlRootElementName, xmlSubmissionUrl = null, xmlBase64RsaPublicKey = null;
						var xmlDeviceIdPropertyName = null, xmlUserIdPropertyName = null;
						for ( var i = 0 ; i < settings.length ; ++i ) {
							var key = settings[i].setting;
							if ( key == "form_id" ) {
								formId = settings[i].value;
							} else if ( key == "form_version" ) {
								formVersion = settings[i].value;
							} else if ( key == "form_title" ) {
								formTitle = settings[i].value;
							} else if ( key == "table_id" ) {
								tableId = settings[i].value;
							} else if ( key == "xml_root_element_name" ) {
								xmlRootElementName = settings[i].value;
							} else if ( key == "xml_submission_url" ) {
								xmlSubmissionUrl = settings[i].value;
							} else if ( key == "xml_base64_rsa_public_key" ) {
								xmlBase64RsaPublicKey = settings[i].value;
							} else if ( key == "xml_device_id_property_name" ) {
								xmlDeviceIdPropertyName = settings[i].value;
							} else if ( key == "xml_user_id_property_name" ) {
								xmlUserIdPropertyName = settings[i].value;
							} else if ( key == "default_locale" ) {
								defaultLocale = settings[i].value;
							}
						}
						
						wlog("before formTitle analysis");
						var formName = null;
						if ( typeof formTitle == "string" ) {
							formName = formTitle;
						} else {
							if ( defaultLocale != null && formTitle[defaultLocale] != null ) {
								formName = formTitle[defaultLocale];
							} else if ( ('default' in formTitle) && formTitle['default'] != null ) {
								formName = formTitle['default'];
							} else {
								for ( var locale in formTitle ) {
									formName = formTitle[locale];
									if ( formName != null ) break;
								}
								if ( formName == null ) {
									formName = name.substring(0,idx);
								}
							}
						}
						
						if ( xmlRootElementName == null ) {
							xmlRootElementName = 'data';
						}
						
						// OK. we should have formId, formVersion, formName, xmlRootElementName
						// 
						// Now we can generate the XML form...
						if ( xmlBase64RsaPublicKey != null ) {
 							var file;
							// create empty output file
							file = fso.CreateTextFile(xmlName,true);
							file.Write("<?xml version=\"1.0\"?>\n" +
							  "<h:html xmlns=\"http://www.w3.org/2002/xforms\" xmlns:h=\"http://www.w3.org/1999/xhtml\" " +
									  "xmlns:ev=\"http://www.w3.org/2001/xml-events\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " + 
									  "xmlns:odk=\"http://www.opendatakit.org/xforms\" xmlns:jr=\"http://openrosa.org/javarosa\">\n" +
							  "<h:head>\n" +
							  "<h:title>Encrypted " + formName + "</h:title>\n" +
							  "<model>\n" +
							  "<instance>\n" +
							  "<data id=\"encrypted\" xmlns=\"http://www.opendatakit.org/xforms/encrypted\" xmlns:orx=\"http://openrosa.org/xforms\">\n" +
							  "<base64EncryptedKey/>\n" +
							  "<orx:meta>\n" +
							  "<orx:instanceID/>\n" +
							  "</orx:meta>\n" +
							  "<media>\n" +
							  "<file/>\n" +
							  "</media>\n" +
							  "<encryptedXmlFile/>\n" +
							  "<base64EncryptedElementSignature/>\n" +
							  "</data>\n" +
							  "</instance>\n" +
							  "<bind nodeset=\"/data/base64EncryptedKey\" type=\"string\" odk:length=\"2048\" />\n" +
							  "<bind nodeset=\"/data/meta/instanceID\" type=\"string\"/>\n" +
							  "<bind nodeset=\"/data/media/file\" type=\"binary\"/>\n" +
							  "<bind nodeset=\"/data/encryptedXmlFile\" type=\"binary\"/>\n" +
							  "<bind nodeset=\"/data/base64EncryptedElementSignature\" type=\"string\" odk:length=\"2048\" />\n" +
							  "</model>\n" +
							  "</h:head>\n" +
							  "<h:body>\n" +
							  "<input ref=\"base64EncryptedKey\"><label>Encrypted Symmetric Key</label></input>\n" +
							  "<input ref=\"meta/instanceID\"><label>InstanceID</label></input>\n" +
							  "<repeat nodeset=\"/data/media\">\n" +
							  "<upload ref=\"file\" mediatype=\"image/*\"><label>media file</label></upload>\n" +
							  "</repeat>\n" +
							  "<upload ref=\"encryptedXmlFile\" mediatype=\"image/*\"><label>submission</label></upload>\n" +
							  "<input ref=\"base64EncryptedElementSignature\"><label>Encrypted Element Signature</label></input>\n" +
							  "</h:body>\n" +
							  "</h:html>");
							file.Close();
 						} else {
							// Legacy forms always use formId, formVersion.
							// TODO: should produce table definition file for published-as forms...
							
							var file;
							// create empty output file
							file = fso.CreateTextFile(xmlName,true);
							file.Write('<h:html xmlns="http://www.w3.org/2002/xforms" \n'+
									'  xmlns:h="http://www.w3.org/1999/xhtml" \n'+
									'  xmlns:ev="http://www.w3.org/2001/xml-events" \n'+
									'  xmlns:xsd="http://www.w3.org/2001/XMLSchema" \n'+
									'  xmlns:jr="http://openrosa.org/javarosa" \n'+
									'  xmlns:orx="http://openrosa.org/xforms/" \n'+
									'  xmlns:odk="http://www.opendatakit.org/xforms">\n'+
									' <h:head>\n'+
									'  <h:title>' + formName + '</h:title>\n'+
									'  <model>\n'+
									'    <instance>\n'+
									'      <'+xmlRootElementName+' id="'+formId+
											((formVersion==null)?'"':('" version="'+formVersion+'"')) + '>\n'+
									'        <orx:meta>\n'+
									'          <orx:instanceID/>\n'+
									((xmlDeviceIdPropertyName == null) ? '' : 
									'          <orx:deviceID/>\n') +
									((xmlUserIdPropertyName == null) ? '' : 
									'          <orx:userID/>\n') +
									'          <orx:timeEnd/>\n' +
									'          <instanceName/>\n' +
									'          <saved/>\n' +
									'        </orx:meta>');
							instanceBody = "\n";
							bindBody = "";
							bodyBody = "";
							var bindPrefix = '    <bind nodeset="/' + xmlRootElementName + '/';
							var instanceBodyPrefix = '        <';
							
							wlog("before model analysis");
							
							bindBody += bindPrefix + 'meta/instanceID" type="string"/>\n';
							if ( xmlDeviceIdPropertyName != null) {
								bindBody += bindPrefix + 'meta/deviceID" type="string"/>\n';
							}
							if ( xmlUserIdPropertyName != null) {
								bindBody += bindPrefix + 'meta/userID" type="string"/>\n';
							}
							bindBody += bindPrefix + 'meta/timeEnd" type="datetime"/>\n';
							bindBody += bindPrefix + 'meta/instanceName" type="string"/>\n';
							bindBody += bindPrefix + 'meta/saved" type="string"/>\n';
							
							var model = jsonDef.model;
							buildFormStructures( instanceBodyPrefix, bindPrefix, '', model );
							file.Write(instanceBody +
									'      </'+xmlRootElementName+'> \n'+
									'    </instance> \n');
							file.Write(bindBody);
							if ( xmlSubmissionUrl != null ) {
								file.Write('    <submission method="form-data-post" ref="/' + xmlRootElementName + '" action="' + xmlSubmissionUrl + '" />\n');
							}
							file.Write('  </model> \n'+
									' </h:head> \n'+
									' <h:body> \n'+
									bodyBody +
									' </h:body> \n'+
									'</h:html>\n');
							file.Close();
						}
					} catch(e) {
						wlog("error: parsing failed for json file: " + formDefFile);
						wlog("error: " + e.message);
					}
				}
			}

			window.setTimeout( function() {
					execFormChange( idxSubfolder + 1);
			},100);
		} else {
			window.terminalOutcome = 1;
		}
	} catch (e) {
		wlog("error: execFormChange: exception");
		wlog("error: " + e.message);
		wlog("FAILURE!");
		window.terminalOutcome = 1;
	}
}

function doExec() {
	// run the command asynchronously.
	window.terminalOutcome = 0;

	// run the command to process 1st subdirectory
	window.setTimeout( function() {
			execFormChange(0);
	},100);
	
	// run the command to process the log file
	continueExec();
}

function continueExec() {
	window.logfile = fso.OpenTextFile(window.logfileName,1,false,-1);
	continueWaitingForCompletion();
}