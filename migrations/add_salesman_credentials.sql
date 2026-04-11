-- Migration to add login credentials to salesman_department table
ALTER TABLE salesman_department
ADD COLUMN login_id VARCHAR(255) UNIQUE NULL AFTER status,
ADD COLUMN password VARCHAR(255) NULL AFTER login_id;