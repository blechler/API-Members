# Get the current date in UNIX timestamp
current_date=$(date +%s)

# Define the age limit (90 days in this case)
max_age_days=90
max_age=$((max_age_days * 86400))

# Loop through each branch
for branch in $(git branch -r | sed 's/origin\///'); do
    # Check if the branch starts with "IADEV"
    if [[ $branch == IADEV* ]]; then
        # Get the last commit date for the branch in UNIX timestamp
        last_commit_date=$(git log -1 --format=%ct $branch)

        # Calculate the age of the branch
        age=$((current_date - last_commit_date))

        # Check if the branch is older than the max age
        if [ $age -gt $max_age ]; then
            # Delete the branch from the remote repository
            git push origin --delete $branch
        fi
    fi
done