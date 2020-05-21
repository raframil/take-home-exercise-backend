import express from 'express';
import { ApolloServer, gql } from 'apollo-server-express';
import { models } from './db';

const PORT = 4001;

const typeDefs = gql`
  type Ticket {
    id: ID!
    title: String!
    isCompleted: Boolean!
    children: [Ticket]!
  }

  type Query {
    # return a list of all root level (parentless) tickets.
    tickets: [Ticket]!

    # return the ticket with the given id
    ticket(id: ID!): Ticket!
  }

  type Mutation {
    # create a ticket with the given params
    createTicket(title: String!, isCompleted: Boolean): Ticket!

    # update the title of the ticket with the given id
    updateTicket(id: ID!, title: String!): Ticket!

    # update ticket.isCompleted as given
    toggleTicket(id: ID!, isCompleted: Boolean!): Ticket!

    # delete this ticket
    removeTicket(id: ID!): Boolean!

    # every children in childrenIds gets their parent set as parentId
    addChildrenToTicket(parentId: ID!, childrenIds: [ID!]!): Ticket!

    # every children in childrenIds gets their parent set as parentId returning an array of tickets
    addChildrenToTicketReturningArray(parentId: ID!, childrenIds: [ID!]!): [Ticket]!

    # the ticket with id: childId gets the ticket with id: parentId as its new parent
    setParentOfTicket(parentId: ID!, childId: ID!): Ticket!

    # the ticket with the given id becomes a root level ticket
    removeParentFromTicket(id: ID!): Ticket!
  }
`;

const resolvers = {
  Query: {
    tickets: async (root, args, context) => {
      return models.Ticket.findAll({
        where: {
          parentId: null,
        },
      });
    },
    ticket: async (root, args, context) => {
      const { id } = args;
      return models.Ticket.findByPk(id);
    },
  },
  Ticket: {
    children: async (parent) => {
      return parent.getChildren();
    },
  },
  Mutation: {
    createTicket: async (root, args, context) => {
      const { title, isCompleted } = args;
      return models.Ticket.create({ title, isCompleted });
    },
    updateTicket: async (root, args, context) => {
      const { id, title } = args;
      return models.Ticket.findByPk(id).then((ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }
        return ticket.update({ title });
      });
    },
    toggleTicket: async (root, args, context) => {
      const { id, isCompleted } = args;
      return models.Ticket.findByPk(id).then((ticket) => {
        if (!ticket) {
          throw new Error('Ticket not found');
        }
        return ticket.update({ isCompleted });
      });
    },
    removeTicket: async (root, args, context) => {
      const { id } = args;
      return models.Ticket.findByPk(id).then((ticket) => {
        if (!ticket) {
          return false;
        }
        return ticket
          .destroy({ where: { id } })
          .then((res) => {
            return true;
          })
          .catch((err) => {
            return false;
          });
      });
    },
    addChildrenToTicket: async (root, args, context) => {
      const { parentId, childrenIds } = args;
      return models.Ticket.findByPk(parentId).then((ticket) => {
        if (!ticket) {
          throw new Error('Parent ticket not found');
        }
        return new Promise((resolve, reject) => {
          childrenIds.forEach((childrenId) => {
            models.Ticket.findByPk(childrenId)
              .then((ticket) => {
                if (!ticket) {
                  reject(`Children ticket ${childrenId} does not exists`);
                }
                resolve(ticket.update({ parentId }));
              })
              .catch((error) => {
                console.log('Error: ', error);
              });
          });
        });
      });
    },
    addChildrenToTicketReturningArray: async (root, args, context) => {
      const { parentId, childrenIds } = args;
      return models.Ticket.findByPk(parentId).then((ticket) => {
        if (!ticket) {
          throw new Error('Parent ticket not found');
        }
        let promises = [];
        childrenIds.forEach((childrenId) => {
          promises.push(
            new Promise((resolve, reject) => {
              models.Ticket.findByPk(childrenId)
                .then((ticket) => {
                  if (!ticket) {
                    reject(`Children ticket ${childrenId} does not exists`);
                  }
                  resolve(ticket.update({ parentId }));
                })
                .catch((error) => {
                  console.log('Error: ', error);
                });
            })
          );
        });
        return Promise.all(promises).then((res) => {
          return res;
        });
      });
    },
    setParentOfTicket: async (root, args, context) => {
      const { parentId, childId } = args;
      return models.Ticket.findByPk(childId).then((ticket) => {
        if (!ticket) {
          return false;
        }
        return ticket.update({ parentId });
      });
    },
    removeParentFromTicket: async (root, args, context) => {
      const { id } = args;
      return models.Ticket.findByPk(id).then((ticket) => {
        if (!ticket) {
          return false;
        }
        return ticket.update({ parentId: null });
      });
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const app = express();
server.applyMiddleware({ app });

app.listen({ port: PORT }, () => {
  console.log(`Server ready at: http://localhost:${PORT}${server.graphqlPath}`);
});
