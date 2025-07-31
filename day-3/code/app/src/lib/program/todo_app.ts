/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/todo_app.json`.
 */
export type TodoApp = {
  "address": "3uhD8YzbpWyTTqe2DWTncYUpfuNmLfEymMNVBTNbLm64",
  "metadata": {
    "name": "todoApp",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createProfile",
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        }
      ]
    },
    {
      "name": "createTodo",
      "discriminator": [
        250,
        161,
        142,
        148,
        131,
        48,
        194,
        181
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "profile",
          "writable": true
        },
        {
          "name": "todo",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  111,
                  100,
                  111
                ]
              },
              {
                "kind": "account",
                "path": "profile"
              },
              {
                "kind": "account",
                "path": "profile.todo_count",
                "account": "profile"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "content",
          "type": "string"
        }
      ]
    },
    {
      "name": "toggleTodo",
      "discriminator": [
        83,
        78,
        30,
        70,
        121,
        65,
        188,
        47
      ],
      "accounts": [],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "profile",
      "discriminator": [
        184,
        101,
        165,
        188,
        95,
        63,
        127,
        188
      ]
    },
    {
      "name": "todo",
      "discriminator": [
        137,
        179,
        206,
        68,
        34,
        36,
        131,
        54
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "nameTooLong",
      "msg": "Name is too long"
    },
    {
      "code": 6001,
      "name": "contentTooLong",
      "msg": "Content is too long"
    },
    {
      "code": 6002,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    }
  ],
  "types": [
    {
      "name": "profile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "key",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "todoCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "todo",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "content",
            "type": "string"
          },
          {
            "name": "completed",
            "type": "bool"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "profileSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 102, 105, 108, 101]"
    },
    {
      "name": "todoSeed",
      "type": "bytes",
      "value": "[116, 111, 100, 111]"
    }
  ]
};
