from django import template
import math

register = template.Library()

@register.filter
def bytes(bytes):
    units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB']
    if bytes == 0:
        number = 0
    else:
        number = int(math.floor(math.log(bytes) / math.log(1024)))
    bytes_string = format(bytes / math.pow(1024, math.floor(number)), '.1f')
    return (bytes_string +  ' ' + units[number])
