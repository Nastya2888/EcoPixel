from django import template

from drawings.translations import current_language_code, translate

register = template.Library()


@register.simple_tag
def t(message):
    return translate(str(message))


@register.simple_tag
def lang_code():
    return current_language_code()


@register.filter(name="t")
def t_filter(message):
    return translate(str(message))
