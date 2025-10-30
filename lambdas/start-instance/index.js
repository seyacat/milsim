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
        
        
        // If instance is already running, do nothing
        if (currentState === 'running') {
            // Continue to redirect
        }
        // If instance is stopped, start it
        else if (currentState === 'stopped') {
            const startParams = {
                InstanceIds: [instanceId]
            };
            
            await ec2.startInstances(startParams).promise();
            // Continue to redirect
        }
        // If instance is in any other state, continue to redirect
        
        // Redirect to game.gato.click after all operations
        return {
            statusCode: 302,
            headers: {
                'Location': 'https://game.gato.click'
            },
            body: ''
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