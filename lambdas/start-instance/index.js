const AWS = require('aws-sdk');

exports.handler = async (event) => {
    const ec2 = new AWS.EC2();
    
    // Get instance ID from environment variable
    const instanceId = process.env.EC2_INSTANCE_ID;
    
    if (!instanceId) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'EC2_INSTANCE_ID environment variable not set'
            })
        };
    }
    
    try {
        // Check instance status
        const describeParams = {
            InstanceIds: [instanceId]
        };
        
        const describeResult = await ec2.describeInstances(describeParams).promise();
        
        if (describeResult.Reservations.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: `Instance ${instanceId} not found`
                })
            };
        }
        
        const instance = describeResult.Reservations[0].Instances[0];
        const currentState = instance.State.Name;
        
        console.log(`Instance ${instanceId} current state: ${currentState}`);
        
        // If instance is already running, do nothing
        if (currentState === 'running') {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `Instance ${instanceId} is already running`,
                    state: currentState
                })
            };
        }
        
        // If instance is stopped, start it
        if (currentState === 'stopped') {
            const startParams = {
                InstanceIds: [instanceId]
            };
            
            await ec2.startInstances(startParams).promise();
            
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: `Instance ${instanceId} is starting`,
                    previousState: currentState,
                    newState: 'pending'
                })
            };
        }
        
        // If instance is in any other state, return current state
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Instance ${instanceId} is in state: ${currentState}`,
                state: currentState
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `Failed to process instance ${instanceId}: ${error.message}`
            })
        };
    }
};