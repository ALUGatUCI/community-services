# ALUG@UCI Community Services
This repository contains the source code that enables ALUG@UCI to host remote containers that give members
the ability to host their own services open to the UCI community.

# Architecture
![Architecture Diagram](Architecture.png)

The website (/website) is a Next.JS app that contains the frontend that enables user interaction and a backend
that communicates with the different tenant hosts and interacts with the database hosted on Supabase.

The Supabase database contains user accounts and container requests. User accounts are only created when a container
is provisioned and contain account status and container location.

The Container API routes requests to a node within a cluster and facilitates container management.

Each node has a local PostgreSQL database that contains relevant information, such as the SSH port and available ports
