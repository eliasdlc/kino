// Generado por `pnpm mcp:generate`. No editar a mano.
//
// La forma de cada operación de la API de Kino, sacada del contrato. El nombre
// y la descripción de cada tool viven en `catalog.ts`, escritos para el agente.

export interface ContractOperation {
  readonly method: string;
  readonly path: string;
  readonly input: Record<string, unknown>;
}

export const OPERATIONS = {
  "account.changeEmail": {
    "method": "POST",
    "path": "/account/email",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "newEmail": {
          "type": "string"
        }
      },
      "required": [
        "newEmail"
      ]
    }
  },
  "account.changePassword": {
    "method": "POST",
    "path": "/account/password",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "currentPassword": {
          "type": "string",
          "minLength": 1
        },
        "newPassword": {
          "type": "string",
          "minLength": 8,
          "maxLength": 128
        }
      },
      "required": [
        "currentPassword",
        "newPassword"
      ]
    }
  },
  "account.overview": {
    "method": "GET",
    "path": "/account",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "account.remove": {
    "method": "POST",
    "path": "/account/delete",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "email": {
          "type": "string"
        }
      },
      "required": [
        "email"
      ]
    }
  },
  "account.rename": {
    "method": "PATCH",
    "path": "/account",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        }
      },
      "required": [
        "name"
      ]
    }
  },
  "account.revokeOtherSessions": {
    "method": "POST",
    "path": "/account/sessions/revoke-others",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "account.revokeSession": {
    "method": "DELETE",
    "path": "/account/sessions/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "account.sessions": {
    "method": "GET",
    "path": "/account/sessions",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "apiKeys.create": {
    "method": "POST",
    "path": "/api-keys",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "ttl": {
          "default": "d90",
          "type": "string",
          "enum": [
            "d30",
            "d90",
            "y1",
            "never"
          ]
        }
      },
      "required": [
        "name"
      ]
    }
  },
  "apiKeys.list": {
    "method": "GET",
    "path": "/api-keys",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "apiKeys.remove": {
    "method": "DELETE",
    "path": "/api-keys/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "apiKeys.revoke": {
    "method": "POST",
    "path": "/api-keys/{id}/revoke",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "energy.advisor": {
    "method": "GET",
    "path": "/energy/advisor",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "energy.applyWeeklyRitual": {
    "method": "POST",
    "path": "/rituals/weekly",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "assignments": {
          "minItems": 1,
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "taskId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "date": {
                "type": "string",
                "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
              }
            },
            "required": [
              "taskId",
              "date"
            ]
          }
        }
      },
      "required": [
        "assignments"
      ]
    }
  },
  "energy.blockProposal": {
    "method": "GET",
    "path": "/energy/blocks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "startHour": {
          "type": "integer",
          "minimum": 0,
          "maximum": 23
        }
      }
    }
  },
  "energy.checkins": {
    "method": "GET",
    "path": "/energy/checkin",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "energy.clearBlock": {
    "method": "DELETE",
    "path": "/energy/blocks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "taskId"
      ]
    }
  },
  "energy.createCheckin": {
    "method": "POST",
    "path": "/energy/checkin",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "currentLevel": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        },
        "sleepQuality": {
          "default": "partial",
          "type": "string",
          "enum": [
            "good",
            "partial",
            "poor"
          ]
        },
        "slot": {
          "type": "string",
          "enum": [
            "morning",
            "afternoon",
            "evening"
          ]
        }
      },
      "required": [
        "currentLevel"
      ]
    }
  },
  "energy.scheduleBlock": {
    "method": "POST",
    "path": "/energy/blocks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "date": {
          "type": "string",
          "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
        },
        "hour": {
          "type": "integer",
          "minimum": 0,
          "maximum": 23
        }
      },
      "required": [
        "taskId",
        "date",
        "hour"
      ]
    }
  },
  "energy.todayPlan": {
    "method": "GET",
    "path": "/energy/plan/today",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "energy.updateAccuracy": {
    "method": "PATCH",
    "path": "/energy/checkin",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "accuracy": {
          "type": "string",
          "enum": [
            "accurate",
            "partial",
            "inaccurate"
          ]
        },
        "slot": {
          "type": "string",
          "enum": [
            "morning",
            "afternoon",
            "evening"
          ]
        }
      },
      "required": [
        "accuracy"
      ]
    }
  },
  "energy.weeklyRitual": {
    "method": "GET",
    "path": "/rituals/weekly",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "energy.windows": {
    "method": "GET",
    "path": "/energy/windows",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "entities.byId": {
    "method": "GET",
    "path": "/entities/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "entities.byPage": {
    "method": "GET",
    "path": "/pages/{pageId}/entities",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "pageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "pageId"
      ]
    }
  },
  "entities.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/entities",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "entities.create": {
    "method": "POST",
    "path": "/systems/{systemId}/entities",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "type": {
          "type": "string",
          "enum": [
            "character",
            "location",
            "object",
            "concept",
            "event",
            "faction",
            "other"
          ]
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "aliases": {
          "maxItems": 50,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255
          }
        },
        "summary": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 1000
            },
            {
              "type": "null"
            }
          ]
        },
        "attributes": {
          "anyOf": [
            {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {}
            },
            {
              "type": "null"
            }
          ]
        },
        "coverImageUrl": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 2048,
              "format": "uri"
            },
            {
              "type": "null"
            }
          ]
        },
        "images": {
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 2048,
            "format": "uri"
          }
        }
      },
      "required": [
        "systemId",
        "type",
        "name"
      ]
    }
  },
  "entities.createRelation": {
    "method": "POST",
    "path": "/entities/{id}/relations",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "toEntityId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "label": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 100
            },
            {
              "type": "null"
            }
          ]
        },
        "notes": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 2000
            },
            {
              "type": "null"
            }
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "toEntityId",
        "id"
      ]
    }
  },
  "entities.graph": {
    "method": "GET",
    "path": "/systems/{systemId}/graph",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "entities.remove": {
    "method": "DELETE",
    "path": "/entities/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "entities.removeRelation": {
    "method": "DELETE",
    "path": "/entities/{id}/relations/{relationId}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "relationId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id",
        "relationId"
      ]
    }
  },
  "entities.update": {
    "method": "PATCH",
    "path": "/entities/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "character",
            "location",
            "object",
            "concept",
            "event",
            "faction",
            "other"
          ]
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "aliases": {
          "maxItems": 50,
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 255
          }
        },
        "summary": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 1000
            },
            {
              "type": "null"
            }
          ]
        },
        "attributes": {
          "anyOf": [
            {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {}
            },
            {
              "type": "null"
            }
          ]
        },
        "coverImageUrl": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 2048,
              "format": "uri"
            },
            {
              "type": "null"
            }
          ]
        },
        "images": {
          "maxItems": 100,
          "type": "array",
          "items": {
            "type": "string",
            "maxLength": 2048,
            "format": "uri"
          }
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "folders.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/folders",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "folders.children": {
    "method": "GET",
    "path": "/folders/{id}/children",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "folders.create": {
    "method": "POST",
    "path": "/systems/{systemId}/folders",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "parentId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {}
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "name",
        "systemId"
      ]
    }
  },
  "folders.remove": {
    "method": "DELETE",
    "path": "/folders/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "folders.update": {
    "method": "PATCH",
    "path": "/folders/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "propertyNames": {
                "type": "string"
              },
              "additionalProperties": {}
            },
            {
              "type": "null"
            }
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "github.disconnect": {
    "method": "DELETE",
    "path": "/integrations/github",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "github.linkRepo": {
    "method": "POST",
    "path": "/systems/{id}/github/link",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "allOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          },
          "required": [
            "id"
          ]
        },
        {
          "type": "object",
          "properties": {
            "owner": {
              "type": "string",
              "minLength": 1,
              "maxLength": 39,
              "pattern": "^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$"
            },
            "repo": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100,
              "pattern": "^[A-Za-z0-9._-]+$"
            },
            "fullName": {
              "type": "string"
            }
          }
        }
      ]
    }
  },
  "github.status": {
    "method": "GET",
    "path": "/integrations/github",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "github.sync": {
    "method": "POST",
    "path": "/systems/{id}/github/sync",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "github.unlinkRepo": {
    "method": "DELETE",
    "path": "/systems/{id}/github/link",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "insights.classify": {
    "method": "POST",
    "path": "/insights/classify",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
        }
      },
      "required": [
        "title"
      ]
    }
  },
  "insights.context": {
    "method": "GET",
    "path": "/insights/context",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "insights.decompose": {
    "method": "POST",
    "path": "/insights/decompose",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "count": {
          "type": "number"
        }
      },
      "required": [
        "taskId"
      ]
    }
  },
  "insights.energyDistribution": {
    "method": "GET",
    "path": "/insights/energy-distribution",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "days": {
          "default": 7,
          "type": "integer",
          "minimum": 1,
          "maximum": 90
        }
      },
      "required": [
        "days"
      ]
    }
  },
  "insights.estimate": {
    "method": "POST",
    "path": "/insights/estimate",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1
        },
        "description": {
          "type": "string"
        }
      },
      "required": [
        "title"
      ]
    }
  },
  "insights.patterns": {
    "method": "GET",
    "path": "/insights/patterns",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "insights.staleSystems": {
    "method": "GET",
    "path": "/insights/stale-systems",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "days": {
          "default": 14,
          "type": "integer",
          "minimum": 1,
          "maximum": 180
        }
      },
      "required": [
        "days"
      ]
    }
  },
  "insights.suggest": {
    "method": "GET",
    "path": "/insights/suggest",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "limit": {
          "default": 10,
          "type": "integer",
          "minimum": 1,
          "maximum": 10
        }
      },
      "required": [
        "limit"
      ]
    }
  },
  "notifications.createReminder": {
    "method": "POST",
    "path": "/push/reminders",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "remindAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
        },
        "label": {
          "type": "string",
          "maxLength": 255
        }
      },
      "required": [
        "taskId",
        "remindAt"
      ]
    }
  },
  "notifications.reminders": {
    "method": "GET",
    "path": "/push/reminders",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "taskId"
      ]
    }
  },
  "notifications.removeReminder": {
    "method": "DELETE",
    "path": "/push/reminders/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "notifications.subscribe": {
    "method": "POST",
    "path": "/push/subscribe",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "endpoint": {
          "type": "string",
          "format": "uri"
        },
        "keys": {
          "type": "object",
          "properties": {
            "auth": {
              "type": "string",
              "minLength": 1
            },
            "p256dh": {
              "type": "string",
              "minLength": 1
            }
          },
          "required": [
            "auth",
            "p256dh"
          ]
        }
      },
      "required": [
        "endpoint",
        "keys"
      ]
    }
  },
  "notifications.unsubscribe": {
    "method": "DELETE",
    "path": "/push/unsubscribe",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "endpoint": {
          "type": "string",
          "format": "uri"
        }
      },
      "required": [
        "endpoint"
      ]
    }
  },
  "onboarding.complete": {
    "method": "POST",
    "path": "/onboarding/complete",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "identity": {
          "default": "propio",
          "type": "string",
          "enum": [
            "estudiante",
            "builder",
            "emprendedor",
            "escritor",
            "propio"
          ]
        },
        "chronotype": {
          "type": "string",
          "enum": [
            "morning",
            "intermediate",
            "evening"
          ]
        },
        "sleepTypicalHours": {
          "type": "integer",
          "minimum": 4,
          "maximum": 12
        },
        "availableHoursPerDay": {
          "type": "integer",
          "minimum": 1,
          "maximum": 16
        },
        "rechargePresets": {
          "default": [],
          "maxItems": 8,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "minLength": 1,
                "maxLength": 50
              },
              "delta": {
                "type": "integer",
                "minimum": -50,
                "maximum": 50
              }
            },
            "required": [
              "label",
              "delta"
            ]
          }
        },
        "firstSystemName": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100
        },
        "seedUnits": {
          "default": [],
          "maxItems": 6,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 255
              },
              "field": {
                "type": "string",
                "maxLength": 100
              }
            },
            "required": [
              "name"
            ]
          }
        },
        "timezone": {
          "type": "string",
          "minLength": 1,
          "maxLength": 50
        }
      },
      "required": [
        "chronotype",
        "sleepTypicalHours",
        "availableHoursPerDay",
        "firstSystemName"
      ]
    }
  },
  "onboarding.status": {
    "method": "GET",
    "path": "/onboarding/status",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "pages.addTag": {
    "method": "POST",
    "path": "/pages/{id}/tags",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "tagId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id",
        "tagId"
      ]
    }
  },
  "pages.byId": {
    "method": "GET",
    "path": "/pages/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "pages.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/pages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "pages.create": {
    "method": "POST",
    "path": "/pages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "parentPageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "title": {
          "type": "string",
          "maxLength": 500
        },
        "content": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "pages.createInSystem": {
    "method": "POST",
    "path": "/systems/{systemId}/pages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "parentPageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "title": {
          "type": "string",
          "maxLength": 500
        },
        "content": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "pages.createSubpage": {
    "method": "POST",
    "path": "/pages/{id}/subpages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "parentPageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "title": {
          "type": "string",
          "maxLength": 500
        },
        "content": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId",
        "id"
      ]
    }
  },
  "pages.linkTask": {
    "method": "POST",
    "path": "/pages/{id}/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "taskId",
        "id"
      ]
    }
  },
  "pages.linkedTasks": {
    "method": "GET",
    "path": "/pages/{id}/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "pages.list": {
    "method": "GET",
    "path": "/pages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "pages.remove": {
    "method": "DELETE",
    "path": "/pages/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "pages.removeTag": {
    "method": "DELETE",
    "path": "/pages/{id}/tags/{tagId}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "tagId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id",
        "tagId"
      ]
    }
  },
  "pages.subpages": {
    "method": "GET",
    "path": "/pages/{id}/subpages",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "pages.tags": {
    "method": "GET",
    "path": "/pages/{id}/tags",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "pages.unlinkTask": {
    "method": "DELETE",
    "path": "/pages/{id}/tasks/{taskId}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "taskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id",
        "taskId"
      ]
    }
  },
  "pages.update": {
    "method": "PATCH",
    "path": "/pages/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 500
            },
            {
              "type": "null"
            }
          ]
        },
        "content": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "folderId": {
          "anyOf": [
            {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            {
              "type": "null"
            }
          ]
        },
        "isPinned": {
          "type": "boolean"
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "search.all": {
    "method": "GET",
    "path": "/search",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "q": {
          "type": "string"
        }
      }
    }
  },
  "settings.get": {
    "method": "GET",
    "path": "/settings",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "settings.update": {
    "method": "PATCH",
    "path": "/settings",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "dailyEnergyLimit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 500
        },
        "timezone": {
          "type": "string",
          "minLength": 1,
          "maxLength": 50
        },
        "theme": {
          "type": "string",
          "enum": [
            "dark",
            "light",
            "system"
          ]
        },
        "notificationsEnabled": {
          "type": "boolean"
        },
        "weeklyReviewDay": {
          "type": "string",
          "enum": [
            "mon",
            "tue",
            "wed",
            "thu",
            "fri",
            "sat",
            "sun"
          ]
        }
      }
    }
  },
  "sprints.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/sprints",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "sprints.close": {
    "method": "POST",
    "path": "/sprints/{id}/close",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "sprints.create": {
    "method": "POST",
    "path": "/systems/{systemId}/sprints",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "goal": {
          "type": "string",
          "maxLength": 500
        },
        "startDate": {
          "type": "string"
        },
        "endDate": {
          "type": "string"
        }
      },
      "required": [
        "systemId",
        "name"
      ]
    }
  },
  "sprints.remove": {
    "method": "DELETE",
    "path": "/sprints/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "sprints.update": {
    "method": "PATCH",
    "path": "/sprints/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "goal": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 500
            },
            {
              "type": "null"
            }
          ]
        },
        "startDate": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "endDate": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "active",
            "completed"
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "stickyNotes.byFolder": {
    "method": "GET",
    "path": "/folders/{folderId}/sticky-notes",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "folderId"
      ]
    }
  },
  "stickyNotes.byPage": {
    "method": "GET",
    "path": "/pages/{pageId}/sticky-notes",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "pageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "pageId"
      ]
    }
  },
  "stickyNotes.createOnFolder": {
    "method": "POST",
    "path": "/folders/{folderId}/sticky-notes",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "maxLength": 200
        },
        "content": {
          "type": "string",
          "maxLength": 500
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "textAnchor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "positionSide": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "left",
                "right",
                "over"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "positionY": {
          "anyOf": [
            {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "positionX": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -5,
              "maximum": 5
            },
            {
              "type": "null"
            }
          ]
        },
        "anchorId": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "folderId"
      ]
    }
  },
  "stickyNotes.createOnPage": {
    "method": "POST",
    "path": "/pages/{pageId}/sticky-notes",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "maxLength": 200
        },
        "content": {
          "type": "string",
          "maxLength": 500
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "textAnchor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "positionSide": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "left",
                "right",
                "over"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "positionY": {
          "anyOf": [
            {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "positionX": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -5,
              "maximum": 5
            },
            {
              "type": "null"
            }
          ]
        },
        "anchorId": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "pageId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "pageId"
      ]
    }
  },
  "stickyNotes.remove": {
    "method": "DELETE",
    "path": "/sticky-notes/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "stickyNotes.stack": {
    "method": "POST",
    "path": "/sticky-notes/stack",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "draggedId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "targetId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "draggedId",
        "targetId"
      ]
    }
  },
  "stickyNotes.update": {
    "method": "PATCH",
    "path": "/sticky-notes/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 200
            },
            {
              "type": "null"
            }
          ]
        },
        "content": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 500
            },
            {
              "type": "null"
            }
          ]
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "positionSide": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "left",
                "right",
                "over"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "positionY": {
          "anyOf": [
            {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "positionX": {
          "anyOf": [
            {
              "type": "number",
              "minimum": -5,
              "maximum": 5
            },
            {
              "type": "null"
            }
          ]
        },
        "anchorId": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "stackId": {
          "anyOf": [
            {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            {
              "type": "null"
            }
          ]
        },
        "textAnchor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "isEureka": {
          "type": "boolean"
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "systems.create": {
    "method": "POST",
    "path": "/systems",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "identityStatement": {
          "type": "string",
          "maxLength": 500
        },
        "templateType": {
          "type": "string",
          "enum": [
            "academic",
            "project",
            "entrepreneurial",
            "personal",
            "writing",
            "custom"
          ]
        },
        "energyIdeal": {
          "type": "string",
          "enum": [
            "high",
            "medium",
            "low"
          ]
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "icon": {
          "default": "folder",
          "type": "string",
          "maxLength": 50
        },
        "expectedFrequency": {
          "type": "string",
          "maxLength": 20
        },
        "triggerContext": {
          "type": "string",
          "maxLength": 255
        }
      },
      "required": [
        "name",
        "color"
      ]
    }
  },
  "systems.list": {
    "method": "GET",
    "path": "/systems",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "systems.remove": {
    "method": "DELETE",
    "path": "/systems/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "systems.reorder": {
    "method": "POST",
    "path": "/systems/reorder",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemIds": {
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          }
        }
      },
      "required": [
        "systemIds"
      ]
    }
  },
  "systems.setup": {
    "method": "POST",
    "path": "/users/setup",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "systems.update": {
    "method": "PATCH",
    "path": "/systems/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 255
        },
        "identityStatement": {
          "type": "string",
          "maxLength": 500
        },
        "templateType": {
          "type": "string",
          "enum": [
            "academic",
            "project",
            "entrepreneurial",
            "personal",
            "writing",
            "custom"
          ]
        },
        "energyIdeal": {
          "type": "string",
          "enum": [
            "high",
            "medium",
            "low"
          ]
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "icon": {
          "default": "folder",
          "type": "string",
          "maxLength": 50
        },
        "expectedFrequency": {
          "type": "string",
          "maxLength": 20
        },
        "triggerContext": {
          "type": "string",
          "maxLength": 255
        },
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "tabs": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "enum": [
                      "backlog",
                      "planning",
                      "action",
                      "archive"
                    ]
                  }
                },
                "defaultTab": {
                  "type": "string",
                  "enum": [
                    "backlog",
                    "planning",
                    "action",
                    "archive"
                  ]
                },
                "composition": {
                  "type": "object",
                  "properties": {
                    "containers": {
                      "type": "object",
                      "properties": {
                        "enabled": {
                          "type": "boolean"
                        },
                        "noun": {
                          "type": "string",
                          "minLength": 1,
                          "maxLength": 24
                        },
                        "nounPlural": {
                          "type": "string",
                          "minLength": 1,
                          "maxLength": 24
                        }
                      },
                      "required": [
                        "enabled",
                        "noun",
                        "nounPlural"
                      ]
                    },
                    "pages": {
                      "type": "object",
                      "properties": {
                        "noun": {
                          "type": "string",
                          "minLength": 1,
                          "maxLength": 24
                        },
                        "nounPlural": {
                          "type": "string",
                          "minLength": 1,
                          "maxLength": 24
                        },
                        "primary": {
                          "type": "boolean"
                        }
                      },
                      "required": [
                        "noun",
                        "nounPlural",
                        "primary"
                      ]
                    },
                    "taskKinds": {
                      "maxItems": 8,
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 40
                          },
                          "label": {
                            "type": "string",
                            "minLength": 1,
                            "maxLength": 32
                          }
                        },
                        "required": [
                          "id",
                          "label"
                        ]
                      }
                    }
                  }
                },
                "dailyWordGoal": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 100000
                },
                "chekhov": {
                  "type": "object",
                  "properties": {
                    "maxMentions": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 50
                    },
                    "minSilentChapters": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 50
                    }
                  },
                  "required": [
                    "maxMentions",
                    "minSilentChapters"
                  ]
                },
                "github": {
                  "type": "object",
                  "properties": {
                    "owner": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 39,
                      "pattern": "^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$"
                    },
                    "repo": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 100,
                      "pattern": "^[A-Za-z0-9._-]+$"
                    }
                  },
                  "required": [
                    "owner",
                    "repo"
                  ]
                }
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tags.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/tags",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "tags.create": {
    "method": "POST",
    "path": "/systems/{systemId}/tags",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 24
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "title",
        "systemId"
      ]
    }
  },
  "tags.remove": {
    "method": "DELETE",
    "path": "/tags/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tags.update": {
    "method": "PATCH",
    "path": "/tags/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 24
        },
        "color": {
          "type": "string",
          "enum": [
            "red",
            "blue",
            "pink",
            "purple",
            "green",
            "orange",
            "yellow",
            "teal",
            "gray",
            "black",
            "white"
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.bulkCreate": {
    "method": "POST",
    "path": "/tasks/bulk",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "tasks": {
          "minItems": 1,
          "maxItems": 50,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "systemId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "title": {
                "type": "string",
                "minLength": 1,
                "maxLength": 500
              },
              "description": {
                "type": "string"
              },
              "status": {
                "type": "string",
                "enum": [
                  "backlog",
                  "week",
                  "tomorrow",
                  "today",
                  "done"
                ]
              },
              "energyLevel": {
                "type": "string",
                "enum": [
                  "high",
                  "medium",
                  "low"
                ]
              },
              "priority": {
                "type": "string",
                "enum": [
                  "critical",
                  "high",
                  "medium",
                  "low"
                ]
              },
              "taskType": {
                "type": "string",
                "enum": [
                  "task",
                  "idea",
                  "event",
                  "reminder",
                  "epic"
                ]
              },
              "dueDate": {
                "type": "string"
              },
              "startDate": {
                "type": "string"
              },
              "estimatedTime": {
                "type": "string",
                "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?$"
              },
              "parentTaskId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "contextTagId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "folderId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "sprintId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              },
              "boardStatus": {
                "type": "string",
                "maxLength": 50
              },
              "recurrenceRule": {
                "anyOf": [
                  {
                    "type": "string",
                    "maxLength": 500
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "metadata": {
                "type": "object",
                "properties": {
                  "eventSubtype": {
                    "type": "string",
                    "enum": [
                      "exam",
                      "quiz",
                      "practice"
                    ]
                  }
                },
                "additionalProperties": {}
              },
              "clientRequestId": {
                "type": "string",
                "format": "uuid",
                "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
              }
            },
            "required": [
              "systemId",
              "title"
            ]
          }
        }
      },
      "required": [
        "tasks"
      ]
    }
  },
  "tasks.bulkMove": {
    "method": "POST",
    "path": "/tasks/bulk-move",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskIds": {
          "minItems": 1,
          "maxItems": 50,
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          }
        },
        "status": {
          "type": "string",
          "enum": [
            "backlog",
            "week",
            "tomorrow",
            "today",
            "done"
          ]
        }
      },
      "required": [
        "taskIds",
        "status"
      ]
    }
  },
  "tasks.bulkUpdate": {
    "method": "PATCH",
    "path": "/tasks/bulk-update",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "taskIds": {
          "minItems": 1,
          "maxItems": 50,
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          }
        },
        "priority": {
          "type": "string",
          "enum": [
            "critical",
            "high",
            "medium",
            "low"
          ]
        }
      },
      "required": [
        "taskIds"
      ]
    }
  },
  "tasks.byFolder": {
    "method": "GET",
    "path": "/systems/{systemId}/folders/{folderId}/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId",
        "folderId"
      ]
    }
  },
  "tasks.byId": {
    "method": "GET",
    "path": "/tasks/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.bySystem": {
    "method": "GET",
    "path": "/systems/{systemId}/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId"
      ]
    }
  },
  "tasks.calendar": {
    "method": "GET",
    "path": "/tasks/calendar",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "from": {
          "type": "string"
        },
        "to": {
          "type": "string"
        }
      },
      "required": [
        "from",
        "to"
      ]
    }
  },
  "tasks.create": {
    "method": "POST",
    "path": "/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500
        },
        "description": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "backlog",
            "week",
            "tomorrow",
            "today",
            "done"
          ]
        },
        "energyLevel": {
          "type": "string",
          "enum": [
            "high",
            "medium",
            "low"
          ]
        },
        "priority": {
          "type": "string",
          "enum": [
            "critical",
            "high",
            "medium",
            "low"
          ]
        },
        "taskType": {
          "type": "string",
          "enum": [
            "task",
            "idea",
            "event",
            "reminder",
            "epic"
          ]
        },
        "dueDate": {
          "type": "string"
        },
        "startDate": {
          "type": "string"
        },
        "estimatedTime": {
          "type": "string",
          "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?$"
        },
        "parentTaskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "contextTagId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "folderId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "sprintId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "boardStatus": {
          "type": "string",
          "maxLength": 50
        },
        "recurrenceRule": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 500
            },
            {
              "type": "null"
            }
          ]
        },
        "metadata": {
          "type": "object",
          "properties": {
            "eventSubtype": {
              "type": "string",
              "enum": [
                "exam",
                "quiz",
                "practice"
              ]
            }
          },
          "additionalProperties": {}
        },
        "clientRequestId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId",
        "title"
      ]
    }
  },
  "tasks.createTimeLog": {
    "method": "POST",
    "path": "/tasks/{id}/time-log",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "startedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
        },
        "endedAt": {
          "type": "string",
          "format": "date-time",
          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
        },
        "durationMinutes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        },
        "source": {
          "default": "timer",
          "type": "string",
          "enum": [
            "timer",
            "manual",
            "pomodoro"
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "systemId",
        "startedAt",
        "endedAt",
        "durationMinutes",
        "id"
      ]
    }
  },
  "tasks.list": {
    "method": "GET",
    "path": "/tasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "energyLevel": {
          "type": "string",
          "enum": [
            "high",
            "medium",
            "low"
          ]
        },
        "status": {
          "type": "string",
          "enum": [
            "backlog",
            "week",
            "tomorrow",
            "today",
            "done"
          ]
        },
        "deleted": {
          "type": "string"
        }
      }
    }
  },
  "tasks.move": {
    "method": "PATCH",
    "path": "/tasks/{id}/move",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": [
            "backlog",
            "week",
            "tomorrow",
            "today",
            "done"
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "status",
        "id"
      ]
    }
  },
  "tasks.moveBoard": {
    "method": "PATCH",
    "path": "/tasks/{id}/board",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "boardStatus": {
          "type": "string",
          "minLength": 1,
          "maxLength": 50
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "boardStatus",
        "id"
      ]
    }
  },
  "tasks.remove": {
    "method": "DELETE",
    "path": "/tasks/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.reorder": {
    "method": "POST",
    "path": "/tasks/reorder",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "ids": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          }
        }
      },
      "required": [
        "ids"
      ]
    }
  },
  "tasks.restore": {
    "method": "POST",
    "path": "/tasks/{id}/restore",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.subtasks": {
    "method": "GET",
    "path": "/tasks/{id}/subtasks",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.timeLogSummary": {
    "method": "GET",
    "path": "/tasks/{id}/time-logs",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.todayPlan": {
    "method": "GET",
    "path": "/tasks/today-plan",
    "input": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "tasks.toggle": {
    "method": "POST",
    "path": "/tasks/{id}/toggle",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "tasks.update": {
    "method": "PATCH",
    "path": "/tasks/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1,
          "maxLength": 500
        },
        "description": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "backlog",
            "week",
            "tomorrow",
            "today",
            "done"
          ]
        },
        "energyLevel": {
          "type": "string",
          "enum": [
            "high",
            "medium",
            "low"
          ]
        },
        "priority": {
          "type": "string",
          "enum": [
            "critical",
            "high",
            "medium",
            "low"
          ]
        },
        "taskType": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "task",
                "idea",
                "event",
                "reminder",
                "epic"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "dueDate": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "startDate": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "estimatedTime": {
          "type": "string",
          "pattern": "^(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?$"
        },
        "parentTaskId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "contextTagId": {
          "anyOf": [
            {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            {
              "type": "null"
            }
          ]
        },
        "folderId": {
          "anyOf": [
            {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            {
              "type": "null"
            }
          ]
        },
        "sprintId": {
          "anyOf": [
            {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            },
            {
              "type": "null"
            }
          ]
        },
        "systemId": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "inTodayPlan": {
          "type": "boolean"
        },
        "recurrenceRule": {
          "anyOf": [
            {
              "type": "string",
              "maxLength": 500
            },
            {
              "type": "null"
            }
          ]
        },
        "metadata": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "eventSubtype": {
                  "type": "string",
                  "enum": [
                    "exam",
                    "quiz",
                    "practice"
                  ]
                }
              },
              "additionalProperties": {}
            },
            {
              "type": "null"
            }
          ]
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.applyPlotOperation": {
    "method": "PATCH",
    "path": "/folders/{id}/plot",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "allOf": [
        {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid",
              "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
            }
          },
          "required": [
            "id"
          ]
        },
        {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "move"
                },
                "chapterId": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                },
                "index": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 2000
                },
                "toChapterId": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                },
                "toIndex": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 2000
                },
                "arc": {
                  "anyOf": [
                    {
                      "type": "string",
                      "maxLength": 60
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "kind",
                "chapterId",
                "index",
                "toChapterId",
                "toIndex"
              ]
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "arc"
                },
                "chapterId": {
                  "type": "string",
                  "format": "uuid",
                  "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
                },
                "index": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 2000
                },
                "arc": {
                  "anyOf": [
                    {
                      "type": "string",
                      "maxLength": 60
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "kind",
                "chapterId",
                "index",
                "arc"
              ]
            }
          ]
        }
      ]
    }
  },
  "writing.chapterSummary": {
    "method": "GET",
    "path": "/pages/{id}/summary",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.closeSession": {
    "method": "POST",
    "path": "/pages/{id}/session",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "startedAt": {
          "type": "string"
        },
        "endedAt": {
          "type": "string"
        },
        "durationMinutes": {
          "type": "integer",
          "minimum": 0,
          "maximum": 1440
        }
      },
      "required": [
        "id",
        "startedAt",
        "endedAt",
        "durationMinutes"
      ]
    }
  },
  "writing.journal": {
    "method": "GET",
    "path": "/folders/{id}/journal",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.manuscript": {
    "method": "GET",
    "path": "/folders/{id}/manuscript",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.overview": {
    "method": "GET",
    "path": "/systems/{id}/writing",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.plot": {
    "method": "GET",
    "path": "/folders/{id}/plot",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.reorderTimeline": {
    "method": "PUT",
    "path": "/systems/{id}/timeline",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "eventIds": {
          "maxItems": 500,
          "type": "array",
          "items": {
            "type": "string",
            "format": "uuid",
            "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
          }
        }
      },
      "required": [
        "id",
        "eventIds"
      ]
    }
  },
  "writing.resolveThread": {
    "method": "PATCH",
    "path": "/entities/{id}/thread",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "resolved": {
          "type": "boolean"
        }
      },
      "required": [
        "id",
        "resolved"
      ]
    }
  },
  "writing.restoreSnapshot": {
    "method": "POST",
    "path": "/snapshots/{id}/restore",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.setCompleted": {
    "method": "PATCH",
    "path": "/pages/{id}/complete",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        },
        "completed": {
          "type": "boolean"
        }
      },
      "required": [
        "id",
        "completed"
      ]
    }
  },
  "writing.snapshot": {
    "method": "GET",
    "path": "/snapshots/{id}",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.snapshots": {
    "method": "GET",
    "path": "/pages/{id}/snapshots",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.storySearch": {
    "method": "GET",
    "path": "/systems/{id}/story-search",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "q": {
          "default": "",
          "type": "string"
        },
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.structure": {
    "method": "GET",
    "path": "/folders/{id}/structure",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.studio": {
    "method": "GET",
    "path": "/systems/{id}/studio",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.threads": {
    "method": "GET",
    "path": "/folders/{id}/threads",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.timeline": {
    "method": "GET",
    "path": "/folders/{id}/timeline",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  "writing.unplaceFromTimeline": {
    "method": "DELETE",
    "path": "/entities/{id}/timeline",
    "input": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$"
        }
      },
      "required": [
        "id"
      ]
    }
  }
} as const satisfies Record<string, ContractOperation>;

/** Toda operación de la API. El catálogo tiene que decidir sobre cada una. */
export type OperationId = keyof typeof OPERATIONS;
