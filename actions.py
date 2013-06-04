from django.template import RequestContext, loader
from django.http import HttpResponse
from django.http import HttpResponseRedirect
import json, codecs
import sys, os, tempfile
import ODKScan_webapp.utils as utils
import tasks

APP_ROOT = os.path.dirname(__file__)

# def process_json_output(filepath):
#     """
#     Modifies segment image paths and sizes so it is easy to use them in the transcribe.html template.
#     """
#     import json, codecs
#     fp = codecs.open(filepath, mode="r", encoding="utf-8")
#     pyobj = json.load(fp, encoding='utf-8')
#     for field in pyobj['fields']:
#         if field['type'] is 'select':
#             #This is because xforms use space to delimit options while the jquery val function uses commas
#             field['value'] = field['value'].replace(' ', ',')
#         for segment in field['segments']:
#             #Modify path
#             image_path = segment.get('image_path')
#             if not image_path: continue
#             segment['name'] = os.path.basename(image_path.split("media")[1]).split(".jpg")[0]
#             #Modify image size
#             dpi = 100.0 #A guess for dots per inch
#             segment_width = segment.get("segment_width", field.get("segment_width", pyobj.get("segment_width")))
#             segment_height = segment.get("segment_height", field.get("segment_height", pyobj.get("segment_height")))
#             if not segment_width or not segment_height: continue
#             segment['width_inches'] = float(segment_width) / dpi
#             segment['height_inches'] = float(segment_height) / dpi
#     return pyobj

def process_forms(modeladmin, request, queryset):
    """
    (re)Process the selected forms.
    Forms uploaded via batch mode are automatically processed.
    """
    for obj in queryset:
        #utils.process_image(obj)
        tasks.process_image.delay(obj.id)
process_forms.short_description = "Process selected forms."

def transcription_context(modeladmin, request, queryset, autofill=None, showSegs=None, formView=None):
    """
    Function for organizing the data that will be rendered by one of the
    transcription view tempaltes.
    """
    form_template = None
    json_outputs = []
    for formImage in queryset:
        if formImage.status == 'f':
            #TODO: Handle this without an exception.
            raise Exception("You cannot transcribe a finalized from.")
        if form_template is None:
            #Set the template to the template the first image is set to.
            form_template = formImage.template
        elif form_template.name != formImage.template.name:
            raise Exception("Mixed templates: " + form_template.name + " and " + formImage.template.name)
        
        json_path = os.path.join(formImage.output_path, 'output.json')
        if not os.path.exists(json_path):
            #i.e. skip unprocessed images
            continue
        transcribed_json_path = os.path.join(formImage.output_path, 'transcription.json')
        if not os.path.exists(transcribed_json_path):
            try:
                os.makedirs(os.path.dirname(transcribed_json_path))
            except:
                pass
            fp = codecs.open(json_path, mode="r", encoding="utf-8")
            pyobj = json.load(fp, encoding='utf-8')#This is where we load the json output
            fp.close()
            pyobj['form_id'] = int(formImage.id)
            pyobj['outputDir'] = os.path.basename(formImage.output_path)
            pyobj['imageName'] = str(formImage)
            pyobj['templateName'] = form_template.name
            pyobj['userName'] = str(request.user)
            pyobj['autofill'] = autofill
            pyobj['showSegs'] = showSegs
            pyobj['formView'] = formView
            utils.print_pyobj_to_json(pyobj, transcribed_json_path)

        with codecs.open(transcribed_json_path, mode="r", encoding="utf-8") as fp:
            pyobj = json.load(fp, encoding='utf-8')
        json_outputs.append(pyobj)
        #print >>sys.stderr, json.dumps(pyobj, ensure_ascii=False, indent=4)
    if form_template is None:
        raise Exception("no template")
    form_template_fp = codecs.open(form_template.json.path, mode="r", encoding="utf-8")
    json_template = json.load(form_template_fp, encoding='utf-8')
    return RequestContext(request, {
                 'template_name':form_template.name,
                 'json_template':json_template,
                 'json_outputs':json_outputs,
                 'user':request.user,
                 'autofill':autofill,
                 'showSegs':showSegs,
                 })

def transcribe(modeladmin, request, queryset):
    """
    Transcribe the selected forms in a table view.
    """
    t = loader.get_template('transcribe.html')
    c = transcription_context(modeladmin, request, queryset, autofill=True, showSegs=True)
    return HttpResponse(t.render(c))
transcribe.short_description = "Transcribe selected forms."

def transcribeFormView(modeladmin, request, queryset):
    """
    Transcribe the forms via a view of the full form.
    """
    t = loader.get_template('formViewSet.html')
    c = transcription_context(modeladmin, request, queryset, formView=True)
    return HttpResponse(t.render(c))
transcribeFormView.short_description = "Transcribe (form view)"

def finalize(modeladmin, request, queryset):
    """
    Finalize prevents further editing on form image transcriptions.
    """
    queryset.update(status='f')
finalize.short_description = "Finalize selected forms."


def generate_csv(modeladmin, request, queryset):
    """
    Outputs a csv where the form fields are columns.
    """
    def json_output_to_field_dict(json_output):
        field_dict = {}
        for field in json_output.get('fields'):
            field_value = field.get('transcription', field.get('value'))
            if field_value is not None:
                field_dict[field['name']] = field_value
        return field_dict
    
    dict_array = []
    form_template = None
    for formImage in queryset:
        json_path = os.path.join(formImage.output_path, 'transcription.json')
        if not os.path.exists(json_path):
            #No transcription.
            json_path = os.path.join(formImage.output_path, 'output.json')
        if not os.path.exists(json_path):
            raise Exception('No json for form image')
        if form_template is None:
            form_template = formImage.template
        elif form_template.name != formImage.template.name:
            raise Exception("Mixed templates: " + form_template.name +
                             " and " + formImage.template.name)
        with codecs.open(json_path, mode="r", encoding="utf-8") as fp:
            json_output = json.load(fp, encoding='utf-8')
            base_dict = {
                '__formTitle__': json_output.get('form_title',
                                                  formImage.template.name),
                '__imageName__': str(formImage),
            }
            base_dict.update(json_output_to_field_dict(json_output))
            dict_array.append(base_dict)
    response = HttpResponse(mimetype='application/octet-stream')
    response['Content-Disposition'] = 'attachment; filename=output.csv'
    utils.dict_to_csv(dict_array, response)
    return response
    # temp_file = tempfile.mktemp()
    # with open(temp_file, 'wb') as csvfile:
    #     utils.dict_to_csv(dict_array, csvfile)
    # response = HttpResponse(mimetype='application/octet-stream')
    # response['Content-Disposition'] = 'attachment; filename=output.csv'
    # fo = open(temp_file)
    # response.write(fo.read())
    # fo.close()
    # return response
generate_csv.short_description = "Generate CSV from selected forms."
