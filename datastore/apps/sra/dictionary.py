data_dictionary = {
    'alternateIdentifierType': 'Alternate Identifier Type',
    'AlternateIdentifier': 'Alternate Identifier',
    'awardNumber': 'Award Number',
    'creatorAffiliation': 'Creator Affiliation',
    'contributorType': 'Contributor Type',
    'contributorName': 'Contributor',
    'contributor': 'Contributor',
    'datacite.creator': 'Creator',
    'datacite.publicationyear': 'Publication Year',
    'datacite.publisher': 'Publisher',
    'datacite.resourcetype': 'Resource Type General',
    'datacite.title': 'Title',
    'title': 'Title',
    'creator': 'Creator',
    'publicationyear': 'Publication Year',
    'publicationYear': 'Publication Year',
    'publisher': 'Publisher',
    'resourcetype': 'Resource Type General',
    'Description': 'Description',
    'description': 'Description',
    'Format': 'Format',
    'format': 'Format',
    'fundingReference': 'Funding Reference',
    'fundingName': 'Funder Name',
    'funderName': 'Funder Name',
    'identifierType': 'Identifier Type',
    'IdentifierType': 'Identifier Type',
    'Identifier': 'Identifier',
    'identifier': 'Identifier',
    'relatedIdentifierType': 'Related Identifier Type',
    'RelatedIdentifierType': 'Related Identifier Type',
    'RelatedIdentifier': 'Related Identifier',
    'relatedIdentifier': 'Related Identifier',
    'relationType': 'Relation Type',
    'ResourceType': 'Resource Type',
    'Rights': 'Rights',
    'rights': 'Rights',
    'RightsURL': 'Rights URI',
    'rightsURI': 'Rights URI',
    'Size': 'Size',
    'size': 'Size',
    'Subject': 'Subject',
    'subject': 'Subject',
    'Version': 'Version',
    'version': 'Version',
}

metadata_order = [
    {'key':'Identifier Type', 'value':'Identifier'},
    'Creator',
    'Title',
    'Publisher',
    'Publication Year',
    'Resource Type General',
    'Resource Type',
    'Description',
    'Subject',
    # {'key':'Contributor Type', 'value':'Contributor'},
    'Contributor',
    {'key':'Alternate Identifier Type', 'value':'Alternate Identifier'},
    {'Additional Label': 'Related Identifier', 'key':'Related Identifier Type', 'value':'Related Identifier'},
    'Relation Type',
    'Size',
    'Format',
    'Version',
    'Rights',
    'Rights URI',
    'Funding Reference',
    'Funder Name',
    'Award Number',
]
