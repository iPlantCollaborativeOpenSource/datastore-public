from django.conf import settings
import os

def google_analytics(request):
    """
    Use the variables returned in this function to
    render your Google Analytics tracking code template.
    """
    context = {}
    ga_prop_id = getattr(settings, 'GOOGLE_ANALYTICS_PROPERTY_ID', False)
    if not settings.DEBUG and ga_prop_id:
        context['GOOGLE_ANALYTICS_PROPERTY_ID'] = ga_prop_id
    return context

def idc_mirrors_version(request):
    """
    Display the IDC_MIRRORS_VERSION on the page
    """
    idc_mirrors_version = os.environ.get('IDC_MIRRORS_VERSION', '0.0.0-dev')
    return {
        'idc_mirrors_version': idc_mirrors_version
    }